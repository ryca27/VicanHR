import { postToBackend } from '../../backend';
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
  @Output() fileContentOutput = new EventEmitter<string | string[][]>();
  fileName: string = '';
  hasFile: boolean = false;
  fileContent: string = '';


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
    this.fileContentOutput.emit('');
    if (!file) return;
    try {
      let content: string | string[][];
      if (/\.xlsx$/i.test(file.name)) {
        const form = new FormData();
        form.append('file', file);
        const preview = await postToBackend('/api/attendance/preview/', form);
        content = preview.rows;
      } else {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let encoding = 'utf-8';
        if (bytes[0] === 255 && bytes[1] === 254) encoding = 'utf-16le';
        if (bytes[0] === 254 && bytes[1] === 255) encoding = 'utf-16be';
        content = new TextDecoder(encoding).decode(bytes);
      }
      if (selection === this.selection) this.fileContentOutput.emit(content);
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
