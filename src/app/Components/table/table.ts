import { Component, Input, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-table',
  imports: [NgClass],
  templateUrl: './table.html',
  styleUrl: './table.scss',
})
export class TableComponent implements OnInit {
  @Input() columns: String[] = []
  @Input() rows: any[] = [];
  @Input() includeCheckBox: boolean = false
  tableRows: Array<Array<string| number| boolean>>= [];

  ngOnInit(){
    for (const row of this.rows){
      let rowToAdd: any[] = []
      for (const key of this.getObjectKeys(row)){
        rowToAdd.push(key)
      }
      this.tableRows.push(rowToAdd)
    }
  }

  getObjectKeys<T extends object>(obj: T) {
    return Object.values(obj) as Array<keyof T>;
  }
}
