import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  imports: [NgClass],
  selector: 'app-table-tab',
  styleUrl: './table-tab.scss',
  templateUrl: './table-tab.html',
})
export class TableTabComponent {
  @Input() tabNames: {name:string,isActive:boolean}[] = [];
  @Output() activeTabOutput: EventEmitter<string> = new EventEmitter<string>();

  changeTab(name: string){
    this.activeTabOutput.emit(name);
    this.tabNames.map(t=> {
      t.isActive = false;
      if(t.name==name){
        t.isActive = true;
      }
      return t;
    })
    
  }
}
