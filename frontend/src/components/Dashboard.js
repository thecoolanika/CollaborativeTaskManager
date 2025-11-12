import React, { useState, useEffect } from 'react';
import {
  Container,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Fab,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';

const Dashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    status: 'To Do',
    priority: 'Medium',
  });
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Initialize Socket.IO connection
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const newSocket = io(apiUrl, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('task_created', (task) => {
      setTasks((prev) => [task, ...prev]);
      toast.info('New task created!');
    });

    newSocket.on('task_updated', (task) => {
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? task : t))
      );
      toast.info('Task updated!');
    });

    newSocket.on('task_deleted', (data) => {
      setTasks((prev) => prev.filter((t) => t._id !== data.id));
      toast.info('Task deleted!');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('/api/tasks');
      setTasks(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch tasks');
    }
  };

  const handleOpenDialog = (task = null) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority || 'Medium',
      });
    } else {
      setEditingTask(null);
      setTaskForm({
        title: '',
        description: '',
        status: 'To Do',
        priority: 'Medium',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTask(null);
    setTaskForm({
      title: '',
      description: '',
      status: 'To Do',
      priority: 'Medium',
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingTask) {
        await axios.put(`/api/tasks/${editingTask._id}`, taskForm);
        toast.success('Task updated!');
      } else {
        await axios.post('/api/tasks', taskForm);
        toast.success('Task created!');
      }
      handleCloseDialog();
      fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await axios.delete(`/api/tasks/${taskId}`);
        toast.success('Task deleted!');
        fetchTasks();
      } catch (error) {
        toast.error('Failed to delete task');
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Done':
        return 'success';
      case 'In Progress':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return 'error';
      case 'Medium':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Task Manager
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            {user?.name || user?.email}
          </Typography>
          <IconButton color="inherit" onClick={handleLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          {tasks.map((task) => (
            <Grid item xs={12} sm={6} md={4} key={task._id}>
              <Card>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      mb: 2,
                    }}
                  >
                    <Typography variant="h6" component="h2">
                      {task.title}
                    </Typography>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(task)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(task._id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    {task.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={task.status}
                      color={getStatusColor(task.status)}
                      size="small"
                    />
                    {task.priority && (
                      <Chip
                        label={task.priority}
                        color={getPriorityColor(task.priority)}
                        size="small"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {tasks.length === 0 && (
          <Typography variant="h6" align="center" sx={{ mt: 4 }}>
            No tasks yet. Create your first task!
          </Typography>
        )}
      </Container>

      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => handleOpenDialog()}
      >
        <AddIcon />
      </Fab>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTask ? 'Edit Task' : 'Create New Task'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Title"
            value={taskForm.title}
            onChange={(e) =>
              setTaskForm({ ...taskForm, title: e.target.value })
            }
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Description"
            value={taskForm.description}
            onChange={(e) =>
              setTaskForm({ ...taskForm, description: e.target.value })
            }
            margin="normal"
            multiline
            rows={4}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={taskForm.status}
              onChange={(e) =>
                setTaskForm({ ...taskForm, status: e.target.value })
              }
              label="Status"
            >
              <MenuItem value="To Do">To Do</MenuItem>
              <MenuItem value="In Progress">In Progress</MenuItem>
              <MenuItem value="Done">Done</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Priority</InputLabel>
            <Select
              value={taskForm.priority}
              onChange={(e) =>
                setTaskForm({ ...taskForm, priority: e.target.value })
              }
              label="Priority"
            >
              <MenuItem value="Low">Low</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="High">High</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingTask ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;

