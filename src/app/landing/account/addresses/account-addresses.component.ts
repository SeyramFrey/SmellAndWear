import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { CustomerService } from '../../../core/services/customer.service';
import { Adresse, Client } from '../../../core/models/models';

@Component({
  selector: 'app-account-addresses',
  templateUrl: './account-addresses.component.html',
  styleUrls: ['./account-addresses.component.scss']
})
export class AccountAddressesComponent implements OnInit, OnDestroy {
  addresses: Adresse[] = [];
  client: Client | null = null;
  loading: boolean = true;
  addressForm!: FormGroup;
  editingAddressId: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private customerService: CustomerService,
    private formBuilder: FormBuilder,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.addressForm = this.formBuilder.group({
      ligne1: ['', Validators.required],
      ligne2: [''],
      ville: ['', Validators.required],
      code_postal: ['', Validators.required]
    });
  }

  private loadData(): void {
    this.customerService.client$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(client => {
      this.client = client;
    });

    this.customerService.addresses$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(addresses => {
      this.addresses = addresses;
      this.loading = false;
    });
  }

  openAddModal(content: any): void {
    this.editingAddressId = null;
    this.addressForm.reset();
    this.modalService.open(content, { centered: true });
  }

  openEditModal(content: any, address: Adresse): void {
    this.editingAddressId = address.id;
    this.addressForm.patchValue({
      ligne1: address.ligne1,
      ligne2: address.ligne2,
      ville: address.ville,
      code_postal: address.code_postal
    });
    this.modalService.open(content, { centered: true });
  }

  async saveAddress(): Promise<void> {
    if (this.addressForm.invalid) return;

    const formValue = this.addressForm.value;

    if (this.editingAddressId) {
      await this.customerService.updateAddress(this.editingAddressId, formValue);
    } else {
      await this.customerService.addAddress(formValue);
    }

    this.modalService.dismissAll();
  }

  async deleteAddress(addressId: string): Promise<void> {
    if (confirm('Are you sure you want to delete this address?')) {
      await this.customerService.deleteAddress(addressId);
    }
  }

  async setAsDefault(addressId: string): Promise<void> {
    await this.customerService.setDefaultAddress(addressId);
  }

  isDefaultAddress(addressId: string): boolean {
    return this.client?.adresse_id === addressId;
  }
}

