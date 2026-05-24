import { Severity, IssueType } from '@prisma/client';

export interface ValidationIssue {
  issueType: IssueType;
  severity: Severity;
  title: string;
  description: string;
  suggestedFix: string;
}

export interface ValidationResult {
  qualityScore: number;
  issues: ValidationIssue[];
}

export function validateProduct(product: {
  productTitle?: string | null;
  description?: string | null;
  brand?: string | null;
  price?: number | null | string;
  mrp?: number | null | string;
  imageUrl?: string | null;
  availability?: string | null;
  color?: string | null;
  size?: string | null;
  material?: string | null;
  gender?: string | null;
}): ValidationResult {
  const issues: ValidationIssue[] = [];
  let score = 100;

  // 1. Missing Title (HIGH, -40)
  if (!product.productTitle || product.productTitle.trim() === '') {
    score -= 40;
    issues.push({
      issueType: IssueType.MISSING_TITLE,
      severity: Severity.HIGH,
      title: 'Missing Product Title',
      description: 'The product listing does not have a title, making it invisible to search results.',
      suggestedFix: 'Add a clear, keyword-rich product title immediately.',
    });
  }
  // 2. Very Short Title (MEDIUM, -15)
  else if (product.productTitle.trim().length < 15) {
    score -= 15;
    issues.push({
      issueType: IssueType.VERY_SHORT_TITLE,
      severity: Severity.MEDIUM,
      title: 'Very Short Title',
      description: `The title is only ${product.productTitle.trim().length} characters. Short titles decrease click-through rates.`,
      suggestedFix: 'Incorporate the brand, key features, color, and target gender into the title to improve search density.',
    });
  }

  // 3. Missing Brand (MEDIUM, -10)
  if (!product.brand || product.brand.trim() === '') {
    score -= 10;
    issues.push({
      issueType: IssueType.MISSING_ATTRIBUTES, // Using missing attributes since missing brand doesn't have an explicit IssueType enum
      severity: Severity.MEDIUM,
      title: 'Missing Product Brand',
      description: 'The brand name is unspecified, which harms filtering and customer trust.',
      suggestedFix: 'Add the brand name or explicitly mark the listing as unbranded.',
    });
  }

  // 4. Invalid Price (HIGH, -30)
  const numPrice = Number(product.price);
  if (product.price === undefined || product.price === null || isNaN(numPrice) || numPrice <= 0) {
    score -= 30;
    issues.push({
      issueType: IssueType.INVALID_PRICE,
      severity: Severity.HIGH,
      title: 'Invalid Selling Price',
      description: 'The price must be a positive numeric value for customers to purchase the item.',
      suggestedFix: 'Set a positive numeric value for the Flipkart selling price.',
    });
  }

  // 5. MRP Lower than Price (HIGH, -30)
  const numMrp = Number(product.mrp);
  if (!isNaN(numPrice) && numPrice > 0 && !isNaN(numMrp) && numMrp > 0 && numMrp < numPrice) {
    score -= 30;
    issues.push({
      issueType: IssueType.MRP_LOWER_THAN_PRICE,
      severity: Severity.HIGH,
      title: 'MRP Lower Than Price',
      description: `The Maximum Retail Price (INR ${numMrp}) is lower than the Selling Price (INR ${numPrice}), which violates consumer laws.`,
      suggestedFix: 'Correct the MRP or reduce the selling price to be less than or equal to the MRP.',
    });
  }

  // 6. Missing Image (HIGH, -25)
  if (!product.imageUrl || product.imageUrl.trim() === '') {
    score -= 25;
    issues.push({
      issueType: IssueType.MISSING_IMAGE,
      severity: Severity.HIGH,
      title: 'Missing Product Image',
      description: 'No product image is associated with this listing. Customers will not buy items without visuals.',
      suggestedFix: 'Upload a clear, high-resolution product image showing the entire item.',
    });
  }
  // 7. Broken Image URL (MEDIUM, -10)
  else {
    const isUrlValid =
      product.imageUrl.startsWith('http://') ||
      product.imageUrl.startsWith('https://') ||
      product.imageUrl.startsWith('/');
    if (!isUrlValid) {
      score -= 10;
      issues.push({
        issueType: IssueType.BROKEN_IMAGE_URL,
        severity: Severity.MEDIUM,
        title: 'Malformed Image URL',
        description: 'The product image URL is not formatted correctly and might fail to load.',
        suggestedFix: 'Ensure the image URL is a valid absolute link (starts with http/https) or valid path.',
      });
    }
  }

  // 8. Weak Description (LOW, -10)
  if (!product.description || product.description.trim().length < 50) {
    score -= 10;
    issues.push({
      issueType: IssueType.WEAK_DESCRIPTION,
      severity: Severity.LOW,
      title: 'Weak Product Description',
      description: 'The description is extremely sparse (under 50 characters). It fails to convey key selling points.',
      suggestedFix: 'Draft a detailed product description outlining materials, care instructions, and sizing fits.',
    });
  }

  // 9. Missing Important Attributes (MEDIUM, -15)
  const missingAttrs = [];
  if (!product.color || product.color.trim() === '') missingAttrs.push('color');
  if (!product.size || product.size.trim() === '') missingAttrs.push('size');
  if (!product.material || product.material.trim() === '') missingAttrs.push('material');
  if (!product.gender || product.gender.trim() === '') missingAttrs.push('gender');

  if (missingAttrs.length > 0) {
    score -= 15;
    issues.push({
      issueType: IssueType.MISSING_ATTRIBUTES,
      severity: Severity.MEDIUM,
      title: 'Missing Specifications',
      description: `The following essential search filters are missing: ${missingAttrs.join(', ')}.`,
      suggestedFix: 'Provide exact specifications in the color, size, material, and gender fields to boost search discoverability.',
    });
  }

  // 10. Out of stock product (LOW, -5)
  if (product.availability === 'OUT_OF_STOCK') {
    score -= 5;
    issues.push({
      issueType: IssueType.OUT_OF_STOCK,
      severity: Severity.LOW,
      title: 'Listing Out of Stock',
      description: 'The listing is currently marked as out of stock, lowering search rankings.',
      suggestedFix: 'Update your inventory levels to toggle availability to in-stock.',
    });
  }

  // Clamp quality score between 0 and 100
  const qualityScore = Math.max(0, Math.min(100, score));

  return {
    qualityScore,
    issues,
  };
}
