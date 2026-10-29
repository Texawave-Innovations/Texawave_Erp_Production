import { Injectable } from "@nestjs/common";
import type {
  DateFormat,
  DensityPreference,
  EffectivePreferences,
  NumberFormatStyle,
  ThemePreference,
  TimeFormat,
} from "../common/formatting-utils.js";
import { isValidIanaTimezone } from "../common/formatting-utils.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { OrganizationSettingsRepository } from "../organization/organization-settings.repository.js";
import type { UpdateUserPreferencesDto } from "./dto/update-user-preferences.dto.js";
import { PreferencesRepository } from "./preferences.repository.js";

export interface UserPreferencesResponse {
  preferences: {
    theme?: string | null;
    density?: string | null;
    locale?: string | null;
    timezone?: string | null;
    dateFormat?: string | null;
    timeFormat?: string | null;
    displayCurrency?: string | null;
    customFields?: Record<string, unknown>;
  } | null;
  effective: EffectivePreferences;
  organizationDefaults: {
    theme: string;
    density: string;
    country: string;
    locale: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    baseCurrency: string;
    currencySymbolPosition: string;
    numberFormat: string;
    fiscalYearStartMonth: number;
  };
}

@Injectable()
export class PreferencesService {
  constructor(
    private readonly repository: PreferencesRepository,
    private readonly orgSettingsRepo: OrganizationSettingsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getPreferences(): Promise<UserPreferencesResponse> {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const [userPref, orgSetting] = await Promise.all([
      this.repository.findByUserId(scope, userId),
      this.orgSettingsRepo.findOrCreateDefault(scope, userId),
    ]);

    const effective = this.resolveEffective(userPref, orgSetting);

    return {
      preferences: userPref
        ? {
            theme: userPref.theme,
            density: userPref.density,
            locale: userPref.locale,
            timezone: userPref.timezone,
            dateFormat: userPref.dateFormat,
            timeFormat: userPref.timeFormat,
            displayCurrency: userPref.displayCurrency,
            customFields: (userPref.customFields ?? {}) as Record<
              string,
              unknown
            >,
          }
        : null,
      effective,
      organizationDefaults: {
        theme: orgSetting.theme,
        density: orgSetting.density,
        country: orgSetting.country,
        locale: orgSetting.locale,
        timezone: orgSetting.timezone,
        dateFormat: orgSetting.dateFormat,
        timeFormat: orgSetting.timeFormat,
        baseCurrency: orgSetting.baseCurrency,
        currencySymbolPosition: orgSetting.currencySymbolPosition,
        numberFormat: orgSetting.numberFormat,
        fiscalYearStartMonth: orgSetting.fiscalYearStartMonth,
      },
    };
  }

  async updatePreferences(
    dto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesResponse> {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    if (dto.timezone && !isValidIanaTimezone(dto.timezone)) {
      throw new BusinessRuleViolationException(
        `Invalid IANA timezone identifier: ${dto.timezone}`,
        "INVALID_TIMEZONE",
      );
    }

    const [updatedPref, orgSetting] = await Promise.all([
      this.repository.upsert(scope, userId, dto),
      this.orgSettingsRepo.findOrCreateDefault(scope, userId),
    ]);

    const effective = this.resolveEffective(updatedPref, orgSetting);

    return {
      preferences: {
        theme: updatedPref.theme,
        density: updatedPref.density,
        locale: updatedPref.locale,
        timezone: updatedPref.timezone,
        dateFormat: updatedPref.dateFormat,
        timeFormat: updatedPref.timeFormat,
        displayCurrency: updatedPref.displayCurrency,
        customFields: (updatedPref.customFields ?? {}) as Record<
          string,
          unknown
        >,
      },
      effective,
      organizationDefaults: {
        theme: orgSetting.theme,
        density: orgSetting.density,
        country: orgSetting.country,
        locale: orgSetting.locale,
        timezone: orgSetting.timezone,
        dateFormat: orgSetting.dateFormat,
        timeFormat: orgSetting.timeFormat,
        baseCurrency: orgSetting.baseCurrency,
        currencySymbolPosition: orgSetting.currencySymbolPosition,
        numberFormat: orgSetting.numberFormat,
        fiscalYearStartMonth: orgSetting.fiscalYearStartMonth,
      },
    };
  }

  async resetPreferences(): Promise<UserPreferencesResponse> {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    await this.repository.deleteByUserId(scope, userId);
    const orgSetting = await this.orgSettingsRepo.findOrCreateDefault(
      scope,
      userId,
    );

    const effective = this.resolveEffective(null, orgSetting);

    return {
      preferences: null,
      effective,
      organizationDefaults: {
        theme: orgSetting.theme,
        density: orgSetting.density,
        country: orgSetting.country,
        locale: orgSetting.locale,
        timezone: orgSetting.timezone,
        dateFormat: orgSetting.dateFormat,
        timeFormat: orgSetting.timeFormat,
        baseCurrency: orgSetting.baseCurrency,
        currencySymbolPosition: orgSetting.currencySymbolPosition,
        numberFormat: orgSetting.numberFormat,
        fiscalYearStartMonth: orgSetting.fiscalYearStartMonth,
      },
    };
  }

  private resolveEffective(
    userPref: {
      theme?: string | null;
      density?: string | null;
      locale?: string | null;
      timezone?: string | null;
      dateFormat?: string | null;
      timeFormat?: string | null;
      displayCurrency?: string | null;
    } | null,
    orgSetting: {
      theme: string;
      density: string;
      country: string;
      locale: string;
      timezone: string;
      dateFormat: string;
      timeFormat: string;
      baseCurrency: string;
      currencySymbolPosition: string;
      numberFormat: string;
      fiscalYearStartMonth: number;
      customFields?: unknown;
    },
  ): EffectivePreferences {
    return {
      theme: (userPref?.theme ??
        orgSetting.theme ??
        "system") as ThemePreference,
      density: (userPref?.density ??
        orgSetting.density ??
        "comfortable") as DensityPreference,
      locale: userPref?.locale ?? orgSetting.locale ?? "en-IN",
      timezone: userPref?.timezone ?? orgSetting.timezone ?? "Asia/Kolkata",
      dateFormat: (userPref?.dateFormat ??
        orgSetting.dateFormat ??
        "DD/MM/YYYY") as DateFormat,
      timeFormat: (userPref?.timeFormat ??
        orgSetting.timeFormat ??
        "12h") as TimeFormat,
      baseCurrency: orgSetting.baseCurrency ?? "INR",
      displayCurrency:
        userPref?.displayCurrency ??
        ((orgSetting.customFields as Record<string, unknown> | null)
          ?.displayCurrency as string | undefined) ??
        orgSetting.baseCurrency ??
        "INR",
      currencySymbolPosition: (orgSetting.currencySymbolPosition ??
        "before") as "before" | "after",
      numberFormat: (orgSetting.numberFormat ?? "indian") as NumberFormatStyle,
      country: orgSetting.country ?? "IN",
      fiscalYearStartMonth: orgSetting.fiscalYearStartMonth ?? 4,
      isUserOverridden: {
        theme: userPref?.theme !== null && userPref?.theme !== undefined,
        density: userPref?.density !== null && userPref?.density !== undefined,
        locale: userPref?.locale !== null && userPref?.locale !== undefined,
        timezone:
          userPref?.timezone !== null && userPref?.timezone !== undefined,
        dateFormat:
          userPref?.dateFormat !== null && userPref?.dateFormat !== undefined,
        timeFormat:
          userPref?.timeFormat !== null && userPref?.timeFormat !== undefined,
        displayCurrency:
          userPref?.displayCurrency !== null &&
          userPref?.displayCurrency !== undefined,
      },
    };
  }
}
