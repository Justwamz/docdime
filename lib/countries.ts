interface CountryConfig {
  name: string;
  currency: string;
  bankingFields: BankingField[];
}

interface BankingField {
  key: string;
  label: string;
  required: boolean;
  placeholder?: string;
}

const countryConfigs: Record<string, CountryConfig> = {
  KE: {
    name: "Kenya",
    currency: "KES",
    bankingFields: [
      { key: "bankName", label: "Bank Name", required: false, placeholder: "e.g. Equity Bank" },
      { key: "accountNumber", label: "Account Number", required: false, placeholder: "Enter account number" },
      { key: "accountName", label: "Account Name", required: false, placeholder: "Name on account" },
      { key: "mpesaNumber", label: "M-Pesa Number", required: false, placeholder: "e.g. 0712345678" },
    ],
  },
  NG: {
    name: "Nigeria",
    currency: "NGN",
    bankingFields: [
      { key: "bankName", label: "Bank Name", required: true, placeholder: "e.g. GTBank" },
      { key: "accountNumber", label: "Account Number (10 digits)", required: true, placeholder: "0123456789" },
      { key: "accountName", label: "Account Name", required: true, placeholder: "Name on account" },
      { key: "bankCode", label: "Bank Code", required: false, placeholder: "e.g. 058" },
    ],
  },
  ZA: {
    name: "South Africa",
    currency: "ZAR",
    bankingFields: [
      { key: "bankName", label: "Bank Name", required: true, placeholder: "e.g. FNB" },
      { key: "accountNumber", label: "Account Number", required: true, placeholder: "Enter account number" },
      { key: "accountName", label: "Account Name", required: true, placeholder: "Name on account" },
      { key: "branchCode", label: "Branch Code", required: true, placeholder: "e.g. 250655" },
    ],
  },
  US: {
    name: "United States",
    currency: "USD",
    bankingFields: [
      { key: "bankName", label: "Bank Name", required: true, placeholder: "e.g. Chase Bank" },
      { key: "accountNumber", label: "Account Number", required: true, placeholder: "Enter account number" },
      { key: "accountName", label: "Account Name", required: true, placeholder: "Name on account" },
      { key: "routingNumber", label: "Routing Number (ABA)", required: true, placeholder: "9-digit routing number" },
    ],
  },
  GB: {
    name: "United Kingdom",
    currency: "GBP",
    bankingFields: [
      { key: "bankName", label: "Bank Name", required: true, placeholder: "e.g. Barclays" },
      { key: "accountNumber", label: "Account Number", required: true, placeholder: "8-digit account number" },
      { key: "accountName", label: "Account Name", required: true, placeholder: "Name on account" },
      { key: "branchCode", label: "Sort Code", required: true, placeholder: "XX-XX-XX" },
      { key: "iban", label: "IBAN", required: false, placeholder: "GB00 XXXX XXXX XXXX XXXX XX" },
    ],
  },
  CA: {
    name: "Canada",
    currency: "CAD",
    bankingFields: [
      { key: "bankName", label: "Bank Name", required: true, placeholder: "e.g. TD Bank" },
      { key: "accountNumber", label: "Account Number", required: true, placeholder: "Enter account number" },
      { key: "accountName", label: "Account Name", required: true, placeholder: "Name on account" },
      { key: "routingNumber", label: "Transit + Institution Number", required: true, placeholder: "XXXXXYYY" },
    ],
  },
  AU: {
    name: "Australia",
    currency: "AUD",
    bankingFields: [
      { key: "bankName", label: "Bank Name", required: true, placeholder: "e.g. Commonwealth Bank" },
      { key: "accountNumber", label: "Account Number", required: true, placeholder: "Enter account number" },
      { key: "accountName", label: "Account Name", required: true, placeholder: "Name on account" },
      { key: "bsb", label: "BSB Number", required: true, placeholder: "XXX-XXX" },
    ],
  },
  DEFAULT: {
    name: "Other",
    currency: "USD",
    bankingFields: [
      { key: "bankName", label: "Bank Name", required: false, placeholder: "Enter bank name" },
      { key: "accountNumber", label: "Account Number", required: false, placeholder: "Enter account number" },
      { key: "accountName", label: "Account Name", required: false, placeholder: "Name on account" },
      { key: "iban", label: "IBAN", required: false, placeholder: "Enter IBAN" },
      { key: "swift", label: "SWIFT/BIC Code", required: false, placeholder: "e.g. XXXXGB2L" },
    ],
  },
};

export function getCountryConfig(countryCode: string): CountryConfig {
  return countryConfigs[countryCode] ?? countryConfigs.DEFAULT;
}

export const countries = [
  { code: "KE", name: "Kenya" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "GH", name: "Ghana" },
  { code: "TZ", name: "Tanzania" },
  { code: "UG", name: "Uganda" },
  { code: "RW", name: "Rwanda" },
  { code: "ET", name: "Ethiopia" },
  { code: "EG", name: "Egypt" },
  { code: "MA", name: "Morocco" },
  { code: "IN", name: "India" },
  { code: "AE", name: "UAE" },
  { code: "SG", name: "Singapore" },
  { code: "JP", name: "Japan" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "OTHER", name: "Other" },
];
