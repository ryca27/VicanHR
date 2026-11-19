import { Component, Input, forwardRef  } from '@angular/core';
import { ReactiveFormsModule, ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms'

@Component({
  selector: 'app-dropdown',
  imports: [ReactiveFormsModule],
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownComponent),
      multi: true
    }
  ]
})
export class DropdownComponent implements ControlValueAccessor {
  @Input() options: { label: string; value: any }[] = [];
  @Input() label: string = "";
  @Input() isRequired: boolean = false;
  
  readonly selectControl = new FormControl('', { nonNullable: true });
  
  onChange: any = () => {};
  onTouched: any = () => {};

  writeValue(value: any): void {
    this.selectControl.setValue(value == null ? '' : String(value), { emitEvent: false });
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    if (isDisabled) this.selectControl.disable({ emitEvent: false });
    else this.selectControl.enable({ emitEvent: false });
  }

  onChanged(event: Event) {
    this.onChange((event.target as HTMLSelectElement).value);
  }
}
