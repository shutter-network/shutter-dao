import { BigNumberish } from 'ethers';

export interface Vesting {
  owner: string;
  curveType: number;
  managed: boolean;
  durationWeeks: number;
  startDate: number;
  amount: BigNumberish;
  initialUnlock: BigNumberish;
}
