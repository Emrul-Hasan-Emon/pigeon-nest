import { BadRequestException, Injectable } from '@nestjs/common';
import { MAX_INT32 } from '../../../shared/constants/limits';
import {
  ConfigField,
  EntityKind,
  getDefinition,
  SectionDefinition,
} from '../registry/section-registry';
import { HomepageLookupService, LookupEntity } from './homepage-lookup.service';

export type SectionConfig = Record<string, unknown>;

export interface ConfigWarning {
  field: string;
  entityId: number;
  message: string;
}

export interface EnrichedConfig {
  config: SectionConfig;
  /** Entities the config points at, per field key. */
  entities: Record<string, LookupEntity[]>;
  warnings: ConfigWarning[];
}

/** Validates, normalises and explains a section config using the registry. */
@Injectable()
export class HomepageConfigService {
  constructor(private readonly lookup: HomepageLookupService) {}

  definitionOrThrow(type: string): SectionDefinition {
    const definition = getDefinition(type);
    if (!definition) {
      throw new BadRequestException(`Unknown sectionType "${type}"`);
    }
    return definition;
  }

  /** Throws 400 on any problem; returns the config with defaults applied. */
  async normalize(type: string, raw: unknown): Promise<SectionConfig> {
    const definition = this.definitionOrThrow(type);
    if (raw === undefined || raw === null) raw = {};
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('config must be an object');
    }
    const input = raw as Record<string, unknown>;

    const known = new Set(definition.fields.map((f) => f.key));
    const unknown = Object.keys(input).filter((k) => !known.has(k));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `config has unknown key(s) for ${type}: ${unknown.join(', ')}`,
      );
    }

    const config: SectionConfig = {};
    for (const field of definition.fields) {
      const value = input[field.key];
      if (value === undefined || value === null) {
        if (field.required) {
          throw new BadRequestException(`config.${field.key} is required`);
        }
        if (field.default !== undefined) config[field.key] = field.default;
        continue;
      }
      config[field.key] = this.parseField(field, value);
    }

    if (definition.exactlyOne) {
      const set = definition.exactlyOne.filter(
        (key) => config[key] !== undefined,
      );
      if (set.length !== 1) {
        throw new BadRequestException(
          `config needs exactly one of: ${definition.exactlyOne.join(', ')}`,
        );
      }
    }

    await this.assertEntitiesExist(definition, config);
    return config;
  }

  /** Config plus the entities it points at, and a warning per ineligible one. */
  async enrich(type: string, config: SectionConfig): Promise<EnrichedConfig> {
    const definition = getDefinition(type);
    const entities: Record<string, LookupEntity[]> = {};
    const warnings: ConfigWarning[] = [];
    if (!definition) return { config, entities, warnings };

    for (const field of definition.fields) {
      if (!field.entity || config[field.key] === undefined) continue;
      const ids = this.idsOf(field, config);
      const found = await this.lookup.lookup(field.entity, ids);
      entities[field.key] = [];
      for (const id of ids) {
        const entity = found.get(id);
        if (!entity) {
          warnings.push({
            field: field.key,
            entityId: id,
            message: `${field.entity} ${id} no longer exists`,
          });
        } else {
          entities[field.key].push(entity);
          if (!entity.eligible) {
            warnings.push({
              field: field.key,
              entityId: id,
              message: `${field.entity} "${entity.name}" is not available on the storefront`,
            });
          }
        }
      }
    }
    return { config, entities, warnings };
  }

  idsOf(field: ConfigField, config: SectionConfig): number[] {
    const value = config[field.key];
    if (field.kind === 'int') return typeof value === 'number' ? [value] : [];
    return Array.isArray(value) ? (value as number[]) : [];
  }

  private parseField(field: ConfigField, value: unknown): unknown {
    const name = `config.${field.key}`;
    switch (field.kind) {
      case 'int':
        return this.parseInt(field, value, name);
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new BadRequestException(`${name} must be a boolean`);
        }
        return value;
      case 'enum':
        if (
          typeof value !== 'string' ||
          !field.enumValues?.includes(value)
        ) {
          throw new BadRequestException(
            `${name} must be one of: ${field.enumValues?.join(', ')}`,
          );
        }
        return value;
      case 'intArray': {
        if (!Array.isArray(value)) {
          throw new BadRequestException(`${name} must be an array`);
        }
        const ids = value.map((v) => this.parseInt(field, v, name));
        const unique = [...new Set(ids)];
        if (field.maxItems && unique.length > field.maxItems) {
          throw new BadRequestException(
            `${name} can have at most ${field.maxItems} items`,
          );
        }
        if (unique.length === 0 && field.required) {
          throw new BadRequestException(`${name} needs at least one item`);
        }
        // an empty optional list means "not set"
        return unique.length === 0 && !field.required ? undefined : unique;
      }
    }
  }

  private parseInt(field: ConfigField, value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new BadRequestException(`${name} must be an integer`);
    }
    const min = field.min ?? (field.entity ? 1 : 0);
    const max = field.max ?? MAX_INT32;
    if (value < min || value > max) {
      throw new BadRequestException(`${name} must be between ${min} and ${max}`);
    }
    return value;
  }

  private async assertEntitiesExist(
    definition: SectionDefinition,
    config: SectionConfig,
  ) {
    for (const field of definition.fields) {
      if (!field.entity || config[field.key] === undefined) continue;
      const ids = this.idsOf(field, config);
      const found = await this.lookup.lookup(field.entity as EntityKind, ids);
      const missing = ids.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new BadRequestException(
          `config.${field.key}: ${field.entity} not found: ${missing.join(', ')}`,
        );
      }
    }
  }
}
