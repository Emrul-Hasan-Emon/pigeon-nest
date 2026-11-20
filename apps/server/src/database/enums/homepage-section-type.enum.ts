// What a homepage section shows. Each type has a definition (config fields,
// defaults, resolver) in src/content/homepage/registry.
export enum HomepageSectionType {
  BANNERS = 'banners',
  CATEGORIES = 'categories',
  CATEGORY_PRODUCTS = 'category_products',
  COLLECTION_PRODUCTS = 'collection_products',
  SPECIFIC_PRODUCTS = 'specific_products',
  SPECIFIC_COLLECTIONS = 'specific_collections',
  FEATURED_PRODUCTS = 'featured_products',
  SELLERS = 'sellers',
}
