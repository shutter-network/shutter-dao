import { ShutterDAOConfig } from './../DaoBuilder/types';
import { ethers } from "ethers";

export const shutterTestConfig: ShutterDAOConfig = {
  name: "Shutter DAO",
  lockStart: Math.floor(Date.now() / 1000), // (Now) Start time of token lock
  lockDuration: 60, // 60 seconds
  snapshotURL: "https://snapshot.org/#/shutterprotodao.eth",
  initialSupply: "10",
  votingPeriod: 2, // Length of time (in blocks) that voting occurs.
  quorum: 4, // Percentage of total possible tokens that must vote in order to consider a proposal result valid.  We should take into account that a large portion of tokens will be locked for investors, who may never vote.
  timeLockPeriod: 2, //  Length of time (in blocks) between when a proposal is passed and when it can be actually be executed.  For the top level Decent DAO we may want to have this be 0
  executionPeriod: 4, // Length of time (in blocks) that a successful proposal has to be executed, after which is will expire.  We can simply set this to the the same length decided on for Voting Period.
  votingBasis: 500000, // the percentage of YES votes required to pass a proposal.  Suggested 50% for a simple majority.
  proposalRequiredWeight: 0, // Required token delegation amount in order to create proposals.  Suggested 1.  Mainnet has less risk of proposal spam, but having something delegated makes sense
};
