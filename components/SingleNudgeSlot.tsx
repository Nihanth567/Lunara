import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GrowCheckBackCard } from '@/components/GrowCheckBackCard';
import { GrowthFollowUpCard } from '@/components/GrowthFollowUpCard';
import { GrowGuidance } from '@/components/GrowGuidance';
import { GrowthTipCard } from '@/components/GrowthTipCard';
import type { UseNudgeResult } from '@/hooks/useNudge';
import { space } from '@/constants/tokens';

/**
 * The only place a growth card appears on Tonight — and only ever one of them.
 *
 * Which one is decided by `pickNudge` in lib/nudge.ts (priority: next-day
 * follow-up → tonight's Grow guidance → the daily tip), and `useNudge` owns
 * the answers. This component just draws the winner. If you are tempted to
 * render one of these cards somewhere else on Tonight, add it here instead.
 */
export function SingleNudgeSlot(props: UseNudgeResult) {
  const { nudge } = props;
  if (!nudge) return null;

  let card: React.ReactNode;
  switch (nudge.kind) {
    case 'checkBack':
      card = (
        <GrowCheckBackCard
          growText={nudge.growText}
          onRespond={(response) => props.respondCheckBack(nudge, response)}
          onDismiss={props.finish}
        />
      );
      break;
    case 'tipFollowUp':
      card = (
        <GrowthFollowUpCard
          tip={nudge.tip}
          onRespond={(response) => props.respondTipFollowUp(nudge, response)}
          onDone={props.finish}
        />
      );
      break;
    case 'guidance':
      card = (
        <GrowGuidance
          growTexts={nudge.growTexts}
          onShown={() => props.guidanceShown(nudge)}
          onDismiss={() => props.dismissGuidance(nudge)}
        />
      );
      break;
    case 'tip':
      card = (
        <GrowthTipCard
          tip={nudge.tip}
          onTry={() => props.tryTip(nudge)}
          onNotNow={() => props.notNowTip(nudge)}
          onDone={props.finish}
        />
      );
      break;
  }

  // Keyed by the nudge so a different one always mounts fresh — no card ever
  // inherits another's "answered" state.
  return (
    <View key={nudge.key} style={styles.slot}>
      {card}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { marginBottom: space.xl },
});
