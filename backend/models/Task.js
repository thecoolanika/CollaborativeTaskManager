const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a task title'],
      trim: true,
      maxlength: [200, 'Title cannot be more than 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot be more than 1000 characters'],
    },
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Done'],
      default: 'To Do',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dueDate: {
      type: Date,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for optimized queries
TaskSchema.index({ status: 1 });
TaskSchema.index({ createdBy: 1 });
TaskSchema.index({ assignedTo: 1 });
TaskSchema.index({ createdAt: -1 });
TaskSchema.index({ dueDate: 1 });

// Compound index for common queries
TaskSchema.index({ status: 1, assignedTo: 1 });
TaskSchema.index({ createdBy: 1, status: 1 });

module.exports = mongoose.model('Task', TaskSchema);

