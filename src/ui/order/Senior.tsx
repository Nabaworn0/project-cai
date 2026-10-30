// The senior technician's face (his sprite, cropped to the head) with what he says, for the ordering game.

import type { ComponentChildren } from 'preact';
import seniorHappy from '../../assets/sprites/senior-happy.png';
import seniorThinking from '../../assets/sprites/senior-thinking.png';

export function Senior({ face, children }: { face: 'thinking' | 'happy'; children: ComponentChildren }) {
  return (
    <div class="order-senior" data-testid="senior-says">
      <span class="order-face" aria-hidden="true">
        <img src={face === 'happy' ? seniorHappy : seniorThinking} alt="" />
      </span>
      <p>
        <b>พี่ช่าง:</b> {children}
      </p>
    </div>
  );
}
