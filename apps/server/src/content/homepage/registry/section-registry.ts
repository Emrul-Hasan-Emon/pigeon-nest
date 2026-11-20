import { BannerPosition } from '../../../database/enums/banner-position.enum';
import { HomepageSectionType } from '../../../database/enums/homepage-section-type.enum';

export type FieldKind = 'int' | 'intArray' | 'enum' | 'boolean';
export type EntityKind =
  | 'category'
  | 'collection'
  | 'product'
  | 'seller'
  | 'banner';

export interface ConfigField {
  key: string;
  label: string;
  kind: FieldKind;
  /** Set when the int / intArray holds ids of this entity. */
  entity?: EntityKind;
  required?: boolean;
  min?: number;
  max?: number;
  maxItems?: number;
  enumValues?: string[];
  default?: number | boolean | string;
  help?: string;
}

export interface SectionDefinition {
  type: HomepageSectionType;
  label: string;
  defaultTitle: string;
  description: string;
  fields: ConfigField[];
  /** Exactly one of these field keys must be set. */
  exactlyOne?: string[];
}

const LIMIT: ConfigField = {
  key: 'limit',
  label: 'Max items',
  kind: 'int',
  min: 1,
  max: 50,
  default: 10,
};

export const SECTION_DEFINITIONS: Record<HomepageSectionType, SectionDefinition> =
  {
    [HomepageSectionType.BANNERS]: {
      type: HomepageSectionType.BANNERS,
      label: 'Banners',
      defaultTitle: 'Banners',
      description: 'Banners picked by position or chosen one by one.',
      exactlyOne: ['position', 'bannerIds'],
      fields: [
        {
          key: 'position',
          label: 'Banner position',
          kind: 'enum',
          enumValues: Object.values(BannerPosition),
          help: 'Shows every live banner at this position.',
        },
        {
          key: 'bannerIds',
          label: 'Banners',
          kind: 'intArray',
          entity: 'banner',
          maxItems: 20,
          help: 'Shows these banners in this order.',
        },
        { ...LIMIT, max: 20 },
      ],
    },
    [HomepageSectionType.CATEGORIES]: {
      type: HomepageSectionType.CATEGORIES,
      label: 'Categories',
      defaultTitle: 'Shop by category',
      description: 'Chosen categories, or all top-level categories when empty.',
      fields: [
        {
          key: 'categoryIds',
          label: 'Categories',
          kind: 'intArray',
          entity: 'category',
          maxItems: 30,
          help: 'Leave empty to show top-level categories.',
        },
        LIMIT,
      ],
    },
    [HomepageSectionType.CATEGORY_PRODUCTS]: {
      type: HomepageSectionType.CATEGORY_PRODUCTS,
      label: 'Category products',
      defaultTitle: 'Products',
      description: 'Newest products of one category.',
      fields: [
        {
          key: 'categoryId',
          label: 'Category',
          kind: 'int',
          entity: 'category',
          required: true,
        },
        {
          key: 'includeSubcategories',
          label: 'Include subcategories',
          kind: 'boolean',
          default: true,
        },
        LIMIT,
      ],
    },
    [HomepageSectionType.COLLECTION_PRODUCTS]: {
      type: HomepageSectionType.COLLECTION_PRODUCTS,
      label: 'Collection products',
      defaultTitle: 'Collection',
      description: 'Newest products of one collection.',
      fields: [
        {
          key: 'collectionId',
          label: 'Collection',
          kind: 'int',
          entity: 'collection',
          required: true,
        },
        LIMIT,
      ],
    },
    [HomepageSectionType.SPECIFIC_PRODUCTS]: {
      type: HomepageSectionType.SPECIFIC_PRODUCTS,
      label: 'Specific products',
      defaultTitle: 'Picked for you',
      description: 'Hand-picked products, shown in the chosen order.',
      fields: [
        {
          key: 'productIds',
          label: 'Products',
          kind: 'intArray',
          entity: 'product',
          required: true,
          maxItems: 50,
        },
      ],
    },
    [HomepageSectionType.SPECIFIC_COLLECTIONS]: {
      type: HomepageSectionType.SPECIFIC_COLLECTIONS,
      label: 'Specific collections',
      defaultTitle: 'Collections',
      description: 'Hand-picked collections, shown in the chosen order.',
      fields: [
        {
          key: 'collectionIds',
          label: 'Collections',
          kind: 'intArray',
          entity: 'collection',
          required: true,
          maxItems: 20,
        },
      ],
    },
    [HomepageSectionType.FEATURED_PRODUCTS]: {
      type: HomepageSectionType.FEATURED_PRODUCTS,
      label: 'Featured products',
      defaultTitle: 'Featured',
      description: 'Newest products marked as featured.',
      fields: [LIMIT],
    },
    [HomepageSectionType.SELLERS]: {
      type: HomepageSectionType.SELLERS,
      label: 'Sellers',
      defaultTitle: 'Top sellers',
      description: 'Chosen sellers, or the newest approved sellers when empty.',
      fields: [
        {
          key: 'sellerIds',
          label: 'Sellers',
          kind: 'intArray',
          entity: 'seller',
          maxItems: 30,
          help: 'Leave empty to show the newest approved sellers.',
        },
        LIMIT,
      ],
    },
  };

export function getDefinition(type: string): SectionDefinition | undefined {
  return (SECTION_DEFINITIONS as Record<string, SectionDefinition>)[type];
}
