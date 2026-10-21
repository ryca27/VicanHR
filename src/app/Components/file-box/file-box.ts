import { Component, Input, Output, EventEmitter } from '@angular/core';
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
  @Output() fileContentOutput: EventEmitter<string> = new EventEmitter<string>();
  fileName: string = '';
  hasFile: boolean = false;
  fileContent: string = '';


  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.fileName = file.name;
      this.hasFile = true;
      this.fileNameOutput.emit(this.fileName)
    } else {
      this.fileName = '';
      this.hasFile = false;
      this.fileNameOutput.emit('')
    }
    const element = event.currentTarget as HTMLInputElement;
    let fileList: FileList | null = element.files;
    
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      const reader = new FileReader();

      // Define what happens once the file reading is done
      reader.onload = (e) => {
        this.fileContent = reader.result as string;
        this.fileContentOutput.emit(this.fileContent);
      };

      // Read the file as plain text
      reader.readAsText(file);
    }
  }
}
