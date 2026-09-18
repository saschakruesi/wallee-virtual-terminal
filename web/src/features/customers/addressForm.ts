export type AddressFormValue = {
  givenName: string
  familyName: string
  organizationName: string
  street: string
  postcode: string
  city: string
  country: string
  emailAddress: string
  phoneNumber: string
}

export function emptyAddressForm(over: Partial<AddressFormValue> = {}): AddressFormValue {
  return {
    givenName: '',
    familyName: '',
    organizationName: '',
    street: '',
    postcode: '',
    city: '',
    country: 'CH',
    emailAddress: '',
    phoneNumber: '',
    ...over,
  }
}

export function addressHasContent(a: Partial<AddressFormValue>): boolean {
  return Boolean(
    (a.street ?? '').trim() ||
    (a.city ?? '').trim() ||
    (a.postcode ?? '').trim() ||
    (a.organizationName ?? '').trim(),
  )
}
