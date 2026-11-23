import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AttendancePost } from './modals/upload/upload.models';

@Component({
  imports: [RouterLink],
  templateUrl: './saved-attendance.html',
  styleUrl: './saved-attendance.scss',
})
export class SavedAttendance {
  private route = inject(ActivatedRoute);
  selectedAttendance = signal<AttendancePost | null>(null);
  error = signal('');

  cutoffId = signal('');
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const id = params.get('id') ?? '';
      this.cutoffId.set(id);
      this.selectedAttendance.set(null);
      this.error.set('');
      void this.load(id);
    });
  }

  private async load(id: string) {
    try {
      const response = await fetch(`/api/attendance/${encodeURIComponent(id)}/`);
      if (!response.ok) {
        throw new Error(response.status === 403 ? 'Sign in as admin or finance to view this cutoff.' :
          'Could not load this attendance cutoff.');
      }
      const saved = await response.json();
      if (this.cutoffId() === id) this.selectedAttendance.set(saved);
    } catch (error) {
      if (this.cutoffId() === id) this.error.set(error instanceof Error ? error.message : 'Could not load this attendance cutoff.');
    }
  }
}
