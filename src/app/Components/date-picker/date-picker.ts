import { Component } from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { provideNativeDateAdapter } from '@angular/material/core';

@Component({
  selector: 'app-date-picker',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
  ],
  providers:[provideNativeDateAdapter()],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.scss',
})
export class DatePickerComponent {

  myDateFilter = (d: Date | null): boolean => {
    if (!d) {
      return false;
    }

    const day = d.getDate();
    const year = d.getFullYear();
    const month = d.getMonth();

    // Check if the day is 15
    if (day === 15) {
      return true;
    }

    // Check if the day is the last day of the month
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    if (day === lastDayOfMonth) {
      return true;
    }

    return false;
  };
}
