import { Component } from '@angular/core';
import {detachmentList, statusList} from './payroll-cutoff-constants'

//Components Import
import {TextboxComponent} from './../../../Components/textbox/textbox'
import {DropdownComponent} from './../../../Components/dropdown/dropdown'
import {ButtonComponent} from './../../../Components/button/button'

@Component({
  selector: 'app-payroll-cutoff',
  imports: [TextboxComponent, DropdownComponent, ButtonComponent],
  templateUrl: './payroll-cutoff.html',
  styleUrl: './payroll-cutoff.scss',
})
export class PayrollCutoff {
  detachmentOptions = detachmentList;
  statusOptions = statusList;

  onPreview(): void {
    //do something
  }
}
