import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService, Task } from './../../services/task';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule], // Required for structural directives like @for or ngFor
  templateUrl: './task-list.html',
  styleUrls: ['./task-list.scss']
})
export class TaskListComponent implements OnInit {
  tasks: Task[] = [];
  errorMessage: string = '';

  constructor(private taskService: TaskService) { }

  ngOnInit(): void {
    this.fetchTasks();
  }

  fetchTasks(): void {
    this.taskService.getTasks().subscribe({
      next: (data) => {
        this.tasks = data;
      },
      error: (err) => {
        this.errorMessage = 'Failed to load tasks from Django backend.';
        console.error(err);
      }
    });
  }
}