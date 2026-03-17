import type { MerchantRecord } from './types.js'

const DEFAULT_MERCHANT_NORMALIZATIONS: MerchantRecord[] = [
  { id: 'sys-amz', userId: null, rawPatterns: ['AMZN', 'AMAZON', 'AMZN MKTP', 'Amazon Pay', 'AMAZON PAY'], normalizedName: 'Amazon', defaultCategoryId: null, isSystem: true },
  { id: 'sys-swiggy', userId: null, rawPatterns: ['SWIGGY', 'Swiggy', 'SWIGGY INSTAMART'], normalizedName: 'Swiggy', defaultCategoryId: null, isSystem: true },
  { id: 'sys-zomato', userId: null, rawPatterns: ['ZOMATO', 'Zomato', 'ZOMATO FOOD'], normalizedName: 'Zomato', defaultCategoryId: null, isSystem: true },
  { id: 'sys-uber', userId: null, rawPatterns: ['UBER', 'Uber', 'UBER EATS', 'UBER TRIP'], normalizedName: 'Uber', defaultCategoryId: null, isSystem: true },
  { id: 'sys-ola', userId: null, rawPatterns: ['OLA', 'Ola', 'OLA CABS'], normalizedName: 'Ola', defaultCategoryId: null, isSystem: true },
  { id: 'sys-netflix', userId: null, rawPatterns: ['NETFLIX', 'Netflix'], normalizedName: 'Netflix', defaultCategoryId: null, isSystem: true },
  { id: 'sys-spotify', userId: null, rawPatterns: ['SPOTIFY', 'Spotify'], normalizedName: 'Spotify', defaultCategoryId: null, isSystem: true },
  { id: 'sys-disney', userId: null, rawPatterns: ['DISNEY', 'DISNEY+', 'HOTSTAR'], normalizedName: 'Disney+ Hotstar', defaultCategoryId: null, isSystem: true },
  { id: 'sys-prime', userId: null, rawPatterns: ['PRIME', 'AMAZON PRIME', 'PRIME VIDEO'], normalizedName: 'Amazon Prime', defaultCategoryId: null, isSystem: true },
  { id: 'sys-electricity', userId: null, rawPatterns: ['BESCOM', 'TPC', 'MSEB', 'DHBVN', 'UPPCL'], normalizedName: 'Electricity Board', defaultCategoryId: null, isSystem: true },
  { id: 'sys-mobile', userId: null, rawPatterns: ['JIO', 'AIRTEL', 'VODAFONE', 'BSNL'], normalizedName: 'Mobile Prepaid', defaultCategoryId: null, isSystem: true },
  { id: 'sys-dth', userId: null, rawPatterns: ['DISH TV', 'TATA SKY', 'AIRTEL DTH', 'SUN DIRECT'], normalizedName: 'DTH', defaultCategoryId: null, isSystem: true },
  { id: 'sys-gas', userId: null, rawPatterns: ['Mahanagar GAS', 'Indraprastha Gas', 'Bhutan Gas'], normalizedName: 'Gas Connection', defaultCategoryId: null, isSystem: true },
  { id: 'sys-water', userId: null, rawPatterns: ['BWSSB', 'DJB', 'MWSS'], normalizedName: 'Water Supply', defaultCategoryId: null, isSystem: true },
  { id: 'sys-metro', userId: null, rawPatterns: ['METRO', 'DMRC'], normalizedName: 'Metro', defaultCategoryId: null, isSystem: true },
  { id: 'sys-petrol', userId: null, rawPatterns: ['IOC', 'HPCL', 'BPCL', 'SHELL', 'PETROL'], normalizedName: 'Petrol Pump', defaultCategoryId: null, isSystem: true },
  { id: 'sys-atm', userId: null, rawPatterns: ['ATM WDL', 'ATM withdrawal', 'ATM WITHDRAWAL'], normalizedName: 'ATM', defaultCategoryId: null, isSystem: true },
  { id: 'sys-salary', userId: null, rawPatterns: ['SALARY', 'Salary', 'PAYROLL', 'NEFT CR', 'IMPS CR'], normalizedName: 'Salary', defaultCategoryId: null, isSystem: true },
  { id: 'sys-interest', userId: null, rawPatterns: ['INTEREST', 'Interest', 'FD INTEREST', 'DIVIDEND'], normalizedName: 'Interest Income', defaultCategoryId: null, isSystem: true },
  { id: 'sys-google', userId: null, rawPatterns: ['GOOGLE', 'GCP', 'YOUTUBE'], normalizedName: 'Google', defaultCategoryId: null, isSystem: true },
  { id: 'sys-apple', userId: null, rawPatterns: ['APPLE', 'iCloud', 'APPLE STORE'], normalizedName: 'Apple', defaultCategoryId: null, isSystem: true },
  { id: 'sys-microsoft', userId: null, rawPatterns: ['MICROSOFT', 'OFFICE 365', 'GITHUB'], normalizedName: 'Microsoft', defaultCategoryId: null, isSystem: true },
]

export function normalizeMerchant(
  rawDescription: string,
  userMerchants: MerchantRecord[] = [],
  systemMerchants: MerchantRecord[] = DEFAULT_MERCHANT_NORMALIZATIONS
): MerchantRecord | null {
  if (!rawDescription) return null

  const upperDesc = rawDescription.toUpperCase()

  // User merchants take priority (they override system)
  for (const merchant of userMerchants) {
    for (const pattern of merchant.rawPatterns) {
      if (upperDesc.includes(pattern.toUpperCase())) {
        return merchant
      }
    }
  }

  // Then check system merchants
  for (const merchant of systemMerchants) {
    for (const pattern of merchant.rawPatterns) {
      if (upperDesc.includes(pattern.toUpperCase())) {
        return merchant
      }
    }
  }

  return null
}

export function getDefaultMerchants(): MerchantRecord[] {
  return DEFAULT_MERCHANT_NORMALIZATIONS
}
