const Task = require('../models/Task');
const redisClient = require('../config/redis');

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
exports.getTasks = async (req, res, next) => {
  try {
    const cacheKey = `tasks:${req.user.id}:${JSON.stringify(req.query)}`;
    
    // Try to get from cache
    const cachedTasks = await redisClient.get(cacheKey);
    if (cachedTasks) {
      return res.status(200).json({
        success: true,
        count: cachedTasks.length,
        data: cachedTasks,
        cached: true,
      });
    }

    // Build query
    const query = {};
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by assigned user or created by user
    if (req.query.myTasks === 'true') {
      query.$or = [
        { assignedTo: req.user.id },
        { createdBy: req.user.id },
      ];
    } else {
      // Show all tasks user is involved with
      query.$or = [
        { assignedTo: req.user.id },
        { createdBy: req.user.id },
      ];
    }

    // Execute query
    const tasks = await Task.find(query)
      .populate('assignedTo', 'email name')
      .populate('createdBy', 'email name')
      .sort({ createdAt: -1 })
      .lean();

    // Cache results for 5 minutes
    await redisClient.set(cacheKey, tasks, 300);

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
exports.getTask = async (req, res, next) => {
  try {
    const cacheKey = `task:${req.params.id}`;
    
    // Try to get from cache
    const cachedTask = await redisClient.get(cacheKey);
    if (cachedTask) {
      return res.status(200).json({
        success: true,
        data: cachedTask,
        cached: true,
      });
    }

    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'email name')
      .populate('createdBy', 'email name')
      .lean();

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Cache task for 5 minutes
    await redisClient.set(cacheKey, task, 300);

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private
exports.createTask = async (req, res, next) => {
  try {
    req.body.createdBy = req.user.id;

    const task = await Task.create(req.body);
    
    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'email name')
      .populate('createdBy', 'email name')
      .lean();

    // Invalidate cache for creator and all assigned users
    const userIdsToInvalidate = [
      req.user.id.toString(),
      ...(populatedTask.assignedTo || []).map(u => u._id ? u._id.toString() : u.toString())
    ];
    await invalidateTaskCache(userIdsToInvalidate);

    // Emit WebSocket event to all users involved in the task
    const io = req.app.get('io');
    if (io) {
      // Emit to task room if users have joined it
      io.to(`task:${populatedTask._id}`).emit('task_created', populatedTask);
      
      // Also emit to user rooms for real-time updates
      userIdsToInvalidate.forEach(userId => {
        io.to(`user:${userId}`).emit('task_created', populatedTask);
      });
    }

    res.status(201).json({
      success: true,
      data: populatedTask,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
exports.updateTask = async (req, res, next) => {
  try {
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Check if user has permission (creator or assigned)
    const isCreator = task.createdBy.toString() === req.user.id;
    const isAssigned = task.assignedTo && task.assignedTo.some(id => id.toString() === req.user.id);
    
    if (!isCreator && !isAssigned) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this task',
      });
    }

    task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('assignedTo', 'email name')
      .populate('createdBy', 'email name')
      .lean();

    // Get all users involved in the task
    const userIdsToInvalidate = [
      task.createdBy._id ? task.createdBy._id.toString() : task.createdBy.toString(),
      ...(task.assignedTo || []).map(u => u._id ? u._id.toString() : u.toString())
    ];
    
    // Invalidate cache
    await invalidateTaskCache(userIdsToInvalidate);
    await redisClient.del(`task:${req.params.id}`);

    // Emit WebSocket event to task room and user rooms
    const io = req.app.get('io');
    if (io) {
      // Emit to task room
      io.to(`task:${task._id}`).emit('task_updated', task);
      
      // Emit to all users involved
      userIdsToInvalidate.forEach(userId => {
        io.to(`user:${userId}`).emit('task_updated', task);
      });
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Check if user is the creator
    if (task.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this task',
      });
    }

    // Get all users involved before deleting
    const userIdsToInvalidate = [
      task.createdBy.toString(),
      ...(task.assignedTo || []).map(a => a.toString())
    ];
    
    await Task.findByIdAndDelete(req.params.id);

    // Invalidate cache
    await invalidateTaskCache(userIdsToInvalidate);
    await redisClient.del(`task:${req.params.id}`);

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      const deleteData = { id: req.params.id };
      
      // Emit to task room
      io.to(`task:${req.params.id}`).emit('task_deleted', deleteData);
      
      // Emit to all users involved
      userIdsToInvalidate.forEach(userId => {
        io.to(`user:${userId}`).emit('task_deleted', deleteData);
      });
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to invalidate task cache for users
async function invalidateTaskCache(userIds) {
  try {
    const userIdArray = Array.isArray(userIds) ? userIds : [userIds];
    const promises = [];
    
    // Invalidate cache for all involved users
    for (const userId of userIdArray) {
      promises.push(redisClient.delPattern(`tasks:${userId}:*`));
    }
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error invalidating cache:', error);
    // Don't throw - cache invalidation failure shouldn't break the request
  }
}

