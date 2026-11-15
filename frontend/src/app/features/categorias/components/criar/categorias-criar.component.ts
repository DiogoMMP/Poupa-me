import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { createPicker } from 'picmo';
import { Subscription, filter, take } from 'rxjs';
import { CategoriasCriarViewModel } from './categorias-criar.view-model';
import { PAPEL_OPTIONS } from '../../constants/categorias.constants';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
/**
 * Component to create a new category.
 * Provides a form where the user can enter the category name, choose an icon (emoji) and its group,
 * then submit to create a new category record.
 */
@Component({
  selector: 'app-categorias-criar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, IconComponent, SelectComponent],
  templateUrl: './categorias-criar.component.html',
  styleUrls: ['./categorias-criar.component.css'],
  providers: [CategoriasCriarViewModel]
})
export class CategoriasCriarComponent implements OnInit, OnDestroy {
  public vm = inject(CategoriasCriarViewModel);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private grupoSub?: Subscription;

  @ViewChild('emojiPickerContainer') pickerContainer!: ElementRef<HTMLElement>;

  form: FormGroup;
  readonly papelOptions = PAPEL_OPTIONS;
  showEmojiPicker = false;
  private picker: any = null;

  constructor() {
    this.form = this.fb.group({
      nome: ['', Validators.required],
      icon: ['', Validators.required],
      grupoId: ['', Validators.required],
      papel: ['']
    });
  }

  /**
   * On init, load the grupos for the "Grupo" select. When opened from a grupo's "Criar categoria" button
   * (`?grupo=<id>`), the grupo comes already selected.
   */
  ngOnInit() {
    this.vm.loadGrupos();
    this.preencherGrupoDoLink();
  }

  /**
   * Aplica o `?grupo=<id>` só depois de os grupos chegarem e só se o grupo existir: um link antigo, de um grupo
   * entretanto apagado, deixa o campo por escolher em vez de o preencher com um valor que o select não mostra.
   */
  private preencherGrupoDoLink(): void {
    const grupoId = this.route.snapshot.queryParamMap.get('grupo');
    if (!grupoId) return;
    this.grupoSub = this.vm.grupoOptions$
      .pipe(filter(options => options.length > 0), take(1))
      .subscribe(options => {
        if (options.some(o => o.value === grupoId)) this.form.patchValue({ grupoId });
      });
  }

  /**
   * On destroy, we make sure to clean up the emoji picker instance to avoid memory leaks.
   */
  ngOnDestroy() {
    this.grupoSub?.unsubscribe();
    this.destroyPicker();
  }

  /**
   * Initializes the emoji picker. We check if the picker is not already initialized and if the container element is available.
   * We use a timeout to ensure that the DOM is ready before we try to create the picker. We also set up an event listener for when an emoji is selected.
   */
  initializePicker() {
    if (!this.picker && this.pickerContainer) {
      setTimeout(() => {
        this.picker = createPicker({
          rootElement: this.pickerContainer.nativeElement,
          theme: 'dark',
          showPreview: false,
          showRecents: true,
          emojiSize: '1.5rem',
          emojisPerRow: 9,
          visibleRows: 8,
        });

        this.picker.addEventListener('emoji:select', (event: any) => {
          this.form.patchValue({ icon: event.emoji });
          this.closeEmojiPicker();
        });
      }, 0);
    }
  }

  /**
   * Toggles the visibility of the emoji picker. If we show the picker, we initialize it. If we hide it, we destroy the
   * instance to free up resources.
   */
  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
    if (this.showEmojiPicker) {
      setTimeout(() => this.initializePicker(), 50);
    } else {
      this.destroyPicker();
    }
  }

  /**
   * Closes the emoji picker and destroys the instance to free up resources. We also trigger change detection to update the view.
   */
  closeEmojiPicker() {
    this.showEmojiPicker = false;
    this.destroyPicker();
    this.cdr.detectChanges();
  }

  /**
   * Destroys the emoji picker instance if it exists. This is important to avoid memory leaks and ensure that we don't
   * have multiple instances of the picker running at the same time.
   * We also set the picker variable to null to indicate that there is no active picker instance.
   */
  destroyPicker() {
    if (this.picker) {
      this.picker.destroy();
      this.picker = null;
    }
  }

  /**
   * Handles the form submission for creating a new category.
   * Validates the form and forwards the values to the ViewModel which performs the API call
   * and manages notifications/loading state.
   */
  onSubmit() {
    if (this.form.valid) {
      this.vm.submit(this.form.value);
    }
  }
}
