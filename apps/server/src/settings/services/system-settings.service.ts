import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SystemSetting } from '../../database/entities/setting/system-setting.entity';
import { MAX_DECIMAL_12_2 } from '../../shared/constants/limits';
import { Actor } from '../../shared/types/actor.type';

type SettingType = 'decimal' | 'int' | 'boolean' | 'enum';

export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  group: string;
  type: SettingType;
  min?: number;
  max?: number;
  // For type 'enum': the values that may be stored.
  options?: string[];
  default: number | boolean | string;
}

// The settings the platform understands. Only these keys can be stored, so a
// typo or an unreviewed value never reaches the code that reads them.
export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'shipping.defaultCharge',
    label: 'Default delivery charge',
    description: 'Charged when no active shipping zone covers the destination country and delivery type.',
    group: 'shipping',
    type: 'decimal',
    min: 0,
    max: MAX_DECIMAL_12_2,
    default: 0,
  },
  {
    key: 'shipping.defaultEstimatedDays',
    label: 'Default delivery time (days)',
    description: 'Shown when no shipping zone covers the destination.',
    group: 'shipping',
    type: 'int',
    min: 0,
    max: 365,
    default: 7,
  },
  {
    key: 'shipping.defaultSupportsLiveAnimal',
    label: 'Ship live birds by default',
    description: 'Whether live birds can be sent to destinations no shipping zone covers.',
    group: 'shipping',
    type: 'boolean',
    default: true,
  },
  {
    key: 'commission.type',
    label: 'Commission type',
    description: 'How the platform commission is worked out for sellers with no commission of their own.',
    group: 'commission',
    type: 'enum',
    options: ['percentage', 'fixed'],
    default: 'percentage',
  },
  {
    key: 'commission.amount',
    label: 'Commission amount',
    description:
      'A percentage (0 to 100) of the order subtotal, or a fixed amount per order, depending on the type.',
    group: 'commission',
    type: 'decimal',
    min: 0,
    max: MAX_DECIMAL_12_2,
    default: 0,
  },
];

const byKey = new Map(SETTING_DEFINITIONS.map((d) => [d.key, d]));

@Injectable()
export class SystemSettingsService {
  constructor(private readonly db: DatabaseService) {}

  async list() {
    const rows = await this.db.systemSetting.find();
    const stored = new Map(rows.map((r) => [r.key, r.value]));
    return SETTING_DEFINITIONS.map((def) => {
      const raw = stored.get(def.key);
      const hasValue = raw !== undefined && raw !== null;
      return {
        ...def,
        value: hasValue ? this.parse(def, raw) : def.default,
        isDefault: !hasValue,
      };
    });
  }

  async update(values: Record<string, unknown>, actor: Actor) {
    const entries = Object.entries(values);
    if (entries.length === 0) throw new BadRequestException('settings cannot be empty');

    const cleaned = entries.map(([key, value]) => {
      const def = byKey.get(key);
      if (!def) throw new BadRequestException(`Unknown setting "${key}"`);
      return { def, value: this.validate(def, value) };
    });

    await this.assertCommissionPair(cleaned);

    await this.db.systemSetting.manager.transaction(async (manager) => {
      const repo = manager.getRepository(SystemSetting);
      const tracker = { updatedBy: actor.id, updaterType: actor.type, updaterName: actor.name };
      for (const { def, value } of cleaned) {
        const existing = await repo.findOne({ where: { key: def.key } });
        if (existing) {
          await repo.update({ key: def.key }, { value: String(value), ...tracker });
        } else {
          await repo.insert({
            key: def.key,
            value: String(value),
            description: def.description,
            group: def.group,
            createdBy: actor.id,
            creatorType: actor.type,
            creatorName: actor.name,
            ...tracker,
          });
        }
      }
    });
    return this.list();
  }

  /** A percentage cannot be over 100, whichever of the two settings is being changed. */
  private async assertCommissionPair(cleaned: { def: SettingDefinition; value: number | boolean | string }[]) {
    if (!cleaned.some((c) => c.def.group === 'commission')) return;
    const given = new Map(cleaned.map((c) => [c.def.key, c.value]));
    const type = (given.get('commission.type') ?? (await this.getString('commission.type'))) as string;
    const amount = (given.get('commission.amount') ?? (await this.getNumber('commission.amount'))) as number;
    if (type === 'percentage' && amount > 100) {
      throw new BadRequestException('A percentage commission cannot be more than 100');
    }
  }

  async getString(key: string): Promise<string> {
    const def = byKey.get(key);
    if (!def || def.type !== 'enum') throw new Error(`"${key}" is not a text setting`);
    const row = await this.db.systemSetting.findOne({ where: { key } });
    return row?.value != null ? row.value : (def.default as string);
  }

  async getNumber(key: string): Promise<number> {
    const def = byKey.get(key);
    if (!def || def.type === 'boolean' || def.type === 'enum') throw new Error(`"${key}" is not a numeric setting`);
    const row = await this.db.systemSetting.findOne({ where: { key } });
    return row?.value != null ? (this.parse(def, row.value) as number) : (def.default as number);
  }

  async getBoolean(key: string): Promise<boolean> {
    const def = byKey.get(key);
    if (!def || def.type !== 'boolean') throw new Error(`"${key}" is not a boolean setting`);
    const row = await this.db.systemSetting.findOne({ where: { key } });
    return row?.value != null ? (this.parse(def, row.value) as boolean) : (def.default as boolean);
  }

  private parse(def: SettingDefinition, raw: string): number | boolean | string {
    if (def.type === 'boolean') return raw === 'true';
    if (def.type === 'enum') return raw;
    return Number(raw);
  }

  private validate(def: SettingDefinition, value: unknown): number | boolean | string {
    if (def.type === 'enum') {
      if (typeof value !== 'string' || !def.options?.includes(value)) {
        throw new BadRequestException(`${def.key} must be one of: ${def.options?.join(', ')}`);
      }
      return value;
    }
    if (def.type === 'boolean') {
      if (typeof value !== 'boolean') throw new BadRequestException(`${def.key} must be true or false`);
      return value;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException(`${def.key} must be a number`);
    }
    if (def.type === 'int' && !Number.isInteger(value)) {
      throw new BadRequestException(`${def.key} must be a whole number`);
    }
    if (def.type === 'decimal' && Math.round(value * 100) / 100 !== value) {
      throw new BadRequestException(`${def.key} can have at most 2 decimal places`);
    }
    if (value < (def.min ?? -Infinity) || value > (def.max ?? Infinity)) {
      throw new BadRequestException(`${def.key} must be between ${def.min} and ${def.max}`);
    }
    return value;
  }
}
