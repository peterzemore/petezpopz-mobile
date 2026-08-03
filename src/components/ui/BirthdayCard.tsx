// PetezPopz — BirthdayCard
//
// Three states, in priority order:
//
//   1. An unexpired gift code is waiting  → show it
//   2. A birthday is on file              → confirm it, nothing to do
//   3. No birthday yet                    → collect month and day
//
// Only month and day are collected. The year isn't needed to send a gift on
// the right day, and asking for a full date of birth is more personal data
// than this feature justifies holding.
//
// Shown to Platinum members only, since they're the ones who get the gift —
// collecting birthdays from customers who'd never receive anything would be
// asking for data with nothing offered in return.
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { saveBirthday } from '../../api/shopify-customer';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

interface Props {
  accessToken: string | null;
  /** "MM-DD" from custom.birthday, or null when not set. */
  birthday?: string | null;
  giftCode?: string | null;
  /** "YYYY-MM-DD" from custom.birthday_gift_expires. */
  giftExpires?: string | null;
  onSaved?: () => void;
}

function isExpired(iso?: string | null): boolean {
  if (!iso) return true;
  // Compared as plain dates: a code that expires today is still usable today.
  const today = new Date().toISOString().slice(0, 10);
  return iso < today;
}

export function BirthdayCard({
  accessToken,
  birthday,
  giftCode,
  giftExpires,
  onSaved,
}: Props) {
  const [month, setMonth] = useState<number | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const hasGift = !!giftCode && !isExpired(giftExpires);

  const stored = useMemo(() => {
    if (!birthday) return null;
    const [mm, dd] = birthday.split('-').map(Number);
    if (!mm || !dd) return null;
    return `${MONTHS[mm - 1]} ${dd}`;
  }, [birthday]);

  const handleSave = useCallback(async () => {
    if (!accessToken || !month || !day || saving) return;
    setSaving(true);
    try {
      await saveBirthday(accessToken, month, day);
      onSaved?.();
      Alert.alert('Saved', `We'll send your gift on ${MONTHS[month - 1]} ${day}.`);
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }, [accessToken, month, day, saving, onSaved]);

  // ── 1. Gift waiting ────────────────────────────────────────────────────────
  if (hasGift) {
    return (
      <View style={styles.giftWrap}>
        <LinearGradient
          colors={[Colors.brand.violet, Colors.brand.rose]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.giftTitle}>🎂 Happy birthday!</Text>
        <Text style={styles.giftBody}>Here's a gift from us. Use it at checkout.</Text>
        <View style={styles.codeBox}>
          <Text style={styles.code}>{giftCode}</Text>
        </View>
        <Text style={styles.giftExpiry}>Valid until {giftExpires}</Text>
      </View>
    );
  }

  // ── 2. Birthday already on file ────────────────────────────────────────────
  if (stored) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>🎂 Birthday on file</Text>
        <Text style={styles.body}>
          {stored} — we'll send you a gift code on the day.
        </Text>
      </View>
    );
  }

  // ── 3. Collect it ──────────────────────────────────────────────────────────
  const maxDay = month ? DAYS_IN_MONTH[month - 1] : 31;
  const dayOptions = Array.from({ length: maxDay }, (_, i) => i + 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🎂 Tell us your birthday</Text>
      <Text style={styles.body}>
        Platinum members get a gift code on their birthday. Month and day only —
        we don't need the year.
      </Text>

      <Text style={styles.pickerLabel}>Month</Text>
      <View style={styles.chipRow}>
        {MONTHS.map((m, i) => {
          const active = month === i + 1;
          return (
            <Pressable
              key={m}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setMonth(i + 1);
                // Clear an out-of-range day, e.g. 31 then switching to Feb.
                if (day && day > DAYS_IN_MONTH[i]) setDay(null);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{m}</Text>
            </Pressable>
          );
        })}
      </View>

      {month && (
        <>
          <Text style={styles.pickerLabel}>Day</Text>
          <View style={styles.chipRow}>
            {dayOptions.map((d) => {
              const active = day === d;
              return (
                <Pressable
                  key={d}
                  style={[styles.chipSmall, active && styles.chipActive]}
                  onPress={() => setDay(d)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Pressable
        style={[styles.saveBtn, (!month || !day || saving) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!month || !day || saving}
      >
        {saving ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.saveBtnText}>Save birthday</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing[4],
    marginTop: Spacing[5],
    padding: Spacing[5],
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: Spacing[2],
  },
  title: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.white,
  },
  body: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  pickerLabel: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    letterSpacing: 1.2,
    marginTop: Spacing[2],
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  chip: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.elevated,
  },
  chipSmall: {
    minWidth: 38,
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.elevated,
  },
  chipActive: {
    backgroundColor: Colors.brand.violet,
    borderColor: Colors.brand.violet,
  },
  chipText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  chipTextActive: { color: Colors.white },
  saveBtn: {
    marginTop: Spacing[3],
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.sm,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  giftWrap: {
    marginHorizontal: Spacing[4],
    marginTop: Spacing[5],
    padding: Spacing[5],
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    gap: Spacing[2],
  },
  giftTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },
  giftBody: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.white,
    opacity: 0.9,
    textAlign: 'center',
  },
  codeBox: {
    marginTop: Spacing[2],
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  code: {
    fontFamily: FontFamily.outfitBold,
    fontSize: 30,
    letterSpacing: 6,
    color: Colors.white,
  },
  giftExpiry: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.xs,
    color: Colors.white,
    opacity: 0.85,
  },
});
