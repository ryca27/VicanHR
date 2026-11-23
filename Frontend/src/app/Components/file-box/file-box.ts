import { postToBackend } from '../../backend';
import type { AttendanceParseResult } from '../../Features/payroll/modals/upload/upload.models';

export interface CheckedAttendanceFile {
  file: File;
  preview: AttendanceParseResult;
}
import { ChangeDetectorRef, inject, Component, Input, Output, EventEmitter } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  imports: [NgClass],
  selector: 'app-file-box',
  styleUrl: './file-box.scss',
  templateUrl: './file-box.html',
})
export class FileBoxComponent {
  @Input() isDisabled: boolean = false;
  @Input() id: number = 0;
  @Output() fileNameOutput: EventEmitter<string> = new EventEmitter<string>();
  @Output() fileContentOutput = new EventEmitter<CheckedAttendanceFile | null>();
  fileName: string = '';
  hasFile: boolean = false;


  private changes = inject(ChangeDetectorRef);
  readError = '';
  reading = false;
  private selection = 0;
  async onFileSelected(event: Event): Promise<void> {
    const selection = ++this.selection;
    const picker = event.target as HTMLInputElement;
    const file = picker.files?.[0];
    picker.value = ''; // Allow another selection of the same file to trigger a fresh preview.
    this.fileName = file?.name ?? '';
    this.hasFile = !!file;
    this.readError = '';
    this.reading = !!file;
    this.fileNameOutput.emit(this.fileName);
    this.fileContentOutput.emit(null);
    if (!file) return;
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await postToBackend('/api/attendance/preview/', form);
      const preview: AttendanceParseResult = { ...result, errors: [], validationError: '' };
      if (selection === this.selection) this.fileContentOutput.emit({ file, preview });
    } catch (error) {
      if (selection === this.selection) {
        this.readError = error instanceof Error ? error.message : 'Could not read the selected file.';
      }
    } finally {
      if (selection === this.selection) this.reading = false;
      this.changes.markForCheck();
    }
  }
}
