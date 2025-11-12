const express = require('express');
const {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
} = require('../controllers/taskController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect); // All routes require authentication

router.route('/').get(getTasks).post(createTask);
router.route('/:id').get(getTask).put(updateTask).delete(deleteTask);

module.exports = router;

