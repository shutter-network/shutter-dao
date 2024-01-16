# Shutter DAO blueprint

This is the official blueprint for a Shutter DAO. Below, you will find the instructions to deploy a Shutter DAO and how to modify the configuration parameters.

This repo comes with a suggested default configuration. If you intend to deploy with the proposed configuration, you can skip the step `2) Modify DAO Parameters`.

## 1) Configuration
Create a `.env` file in the root depository of the project.

For your convenience, you execute the following command in the repository's root directory.

``` 
cp .env.example .env
```

Configure the following parameters:

```
# Etherscan API key to verify the contracts
ETHERSCAN_API_KEY=
# Ethereum mainnet RPC provider
MAINNET_PROVIDER=
# Private key used to deploy and configure the contracts
MAINNET_DEPLOYER_PRIVATE_KEY=
# Choose a random value to determine the DAO's safe address
# it is recommended to use "openssl rand -hex 32 | tr -dc '[0-9]'"
MAINNET_SAFE_SALT=
```

Deploying all contracts requires around 15.2M gas. At a gas price of 30 Gwei, this would cost around 0.5 ETH.  
Make sure to have the account funded with *at least* that amount of ETH. Note that the total costs to deploy a DAO depends on the current gas price.

## 2) Modify DAO parameters

If you want to alter DAO parameter settings, you can make the following changes:

### 2.1) Changing token allocations and vesting schedules
You need to generate a new Merkle root hash to change token allocation and vesting schedules.
Please visit https://github.com/shutter-network/shutter-dao-claiming-app-data and follow the README.
Modify the CSV files to your needs and execute the Merkle root hash generation. Replace the parameter
`rootHash` and `tokenBalance` under `airdropConfig` in `config/shutterDaoConfig.ts` with the generated values.

### 2.2) DAO governance parameters
Inside the `config/shutterDAOConfig.ts`, you could change a DAO parameters as you wish.
Please remember that the values `airdrop.rootHash` and `airdrop.tokenBalance` should be taken from the generated output
file as described above.

```
{
  // name of the DAO
  name: 'Shutter DAO',
  // Snapshot | url of the snapshot page if one exists
  snapshotURL: '',
  // Linear Strategy |  Length of time that voting occurs
  votingPeriodBlocks: 5, // (blocks)
  // Linear Strategy | Length of time between when a proposal is passed and when it can be actually be executed.  For the top level Decent DAO we may want to have this be 0
  timeLockPeriodBlocks: 0, // (blocks)
  // Linear Strategy | Length of time that a successful proposal has to be executed, after which is will expire.  We can simply set this to the the same length decided on for Voting Period.
  executionPeriodBlocks: 86400, // (blocks)
  // Linear Strategy | Percentage of total possible tokens that must vote in order to consider a proposal result valid.  We should take into account that a large portion of tokens will be locked for investors, who may never vote.
  quorumBasisNumerator: 4, // (basis points, will be divided by 1_000_000)
  // Linear Strategy | Percentage of total possible tokens that must vote YES in order to pass a proposal.  Suggested 50% for a simple majority.
  votingBasisNumerator: 500000, // (basis points, will be divided by 1_000_000)
  // Linear Strategy | Percentage of total possible tokens that must be delegated to a user in order for them to create a proposal.  Suggested 1%.
  proposalRequiredWeightTokens: 0,  // (delegated voting token balance)

  // Airdrop | Configuration for the airdrop contract.
  airdropConfig: {
    // Total sum of the airdrop allocations as defined in the allocations referenced by the root hash.
    tokenBalance: BigNumber.from('405642857142857047400000000'), // (wei)
    // Root hash of the airdrop merkle tree.
    rootHash: '0x07ad1b3aa5ce0e596eeef606c53ba868ba435b052a6b11e7aa7a55a5b6f6b02a',
    // Deadline for the airdrop redemption.  This is the timestamp after which the airdrop will be closed.
    redeemDeadline: 1721000000, // (seconds; 1721000000 ~= 2024-07-14T23:33:20 UTC)
  },

  // The initial keyper set that is associated with the DAO. Taken from the Shutter keyper set 1 as deployed on Gnosis chain at `0x5162f51ef5cb9d12f5f64e17fc910d17af37f833`
  initialKeyperSet: {
    keypers: [
      "0x52e94E093a162F1D3D5481828cfaB3807Ea32b3A",
      "0x1c0a6fDd52A0c3F18cd6640695884e6248a13533",
      "0x618509C70Bd8b97b78B43c6AF081a55f7225901f",
      "0x3cA93C6c6E3081B26eCA2af4ec2E50d1BA975aE4",
      "0x90A09a9797A04CA679D8F8A6748f728D8f49F34B",
      "0x7238E49003771F9A1bE44585483979c69B6b0F5c",
      "0x23d33956940083e0E92Dd608D6E576AfbEcc83a9",
      "0x772213aaD4c6B37d2cc0Fa3B74F9ace5a028B8C8",
      "0xcB43AEAA8c029Da18A499dC684FdD250ab3FCd13",
      "0xf8A17443c1e98535aBe4D6D9Fdb9C99E8D36D87a",
      "0xfc7d75e4bb6D18591cDc1E766CE7cF231bc08fBc",
      "0xE1A425b2726D92Bc5178e7F5Ed30256481F5337f",
      "0x322F63e33B35CD227a51ae2B8b7Ef9EB8Ca8A238",
    ],
    collator: "0xe67b35a6eC0F206F28C72c32c6F9dA55D8c3943D",
    thresholdRatio: 0.3,
    activationBlock: 18234313,
  },
};
```

## 3) Deploy DAO

### 3.1) Set up environment

Requirements: 

- Node.js >=v18

In the root directory, execute

```
npm install
```

### 3.2) Run deployment command

After configuring all necessary files, as in the steps above, execute the following commands in the root directory.
``` 
npx hardhat --network mainnet deploy-contracts
```

A message `🚀 Shutter DAO contracts successfully deployed 🚀` will be displayed once the contracts are successfully and completely deployed.


#### Ensure that the contracts are verified on Etherscan

The `deploy-contracts` task will also automatically attempt to verify the contracts on Etherscan.
This can sometimes fail due to rate limiting. If this should happen just run the following command again to complete the verification:

```shell
npx hardhat --network mainnet verify-contracts
```

(Note that a message like: `Failed to verify contract Collator: NOTOK, Already Verified` is not an error, but just 
means that the contract was already verified.)


After successfully executing the deployment command, the deployment artifacts will be stored in `deployments/mainnet/`
in the project's root directory. You will need these files in the next step.

## 4) Proposing the deployment
After successfully deploying a shutter DAO, you can propose the deployment to the community by creating a PR in 
[shutter-dao-deployment-artifacts](https://github.com/shutter-network/shutter-dao-deployment-artifacts).

Please upload the generated files in a PR.

You can do this by executing the following commands (outside of this repository):

```
git clone git@github.com:shutter-network/shutter-dao-deployment-artifacts.git
cd shutter-dao-deployment-artifacts
git checkout -b <<YOUR_BRANCH_NAME>> 
cp -a <<PATH_TO_SHUTTER_DAO_REPOSITORY>>/deployments .
git add deployments
git commit -m "Shutter DAO deployment by <<YOUR_NAME>>"
git push -u origin <<YOUR_BRANCH_NAME>>
```

This will create a new branch in the `shutter-dao-deployment-artifacts` repository and push the deployment artifacts to it.
Please open a PR with this branch against the `main` branch of the `shutter-dao-deployment-artifacts` repository.
