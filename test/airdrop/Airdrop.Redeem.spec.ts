import { expect } from 'chai';
import { deployments, ethers, waffle } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
  deployTestToken,
  getAirdropContract, getExecutor, getMock, getTestTokenContract, getUserVestingProxy,
  getVestingLibraryContract,
  getVestingPoolContract,
  getVestingPoolManagerContract
} from "../utils/setup";
import { Vesting } from '../../src/utils/types';
import { calculateVestingHash } from '../../src/utils/hash';
import { BigNumber, Contract } from 'ethers';
import { generateRoot, generateProof } from '../../src/utils/proof';
import { setNextBlockTime } from '../utils/state';

describe('Airdrop - Redeem', async () => {
  const vestingStart = new Date().getTime();
  const redeemDeadline = new Date().getTime() + 60 * 60 * 1000;
  const users = waffle.provider.getWallets();
  const [airdropManager, user1, user2] = users;

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['ShutterToken', 'VestingLibrary', 'VestingPool']);
    const airdropContract = await getAirdropContract();
    const token = await deployTestToken(airdropManager.address);
    const vestingLibraryContract = await getVestingLibraryContract();
    const vestingLibrary = await vestingLibraryContract.deploy();
    const poolContract = await getVestingPoolContract(vestingLibrary.address);
    const vestingPool = await poolContract.deploy();
    const vestingPoolManagerContract = await getVestingPoolManagerContract();
    const vestingPoolManager = await vestingPoolManagerContract.deploy(
      token.address,
      vestingPool.address,
      airdropManager.address,
    );
    const airdrop = await airdropContract.deploy(
      token.address,
      airdropManager.address,
      redeemDeadline,
      vestingPoolManager.address,
    );
    return {
      token,
      airdrop,
      vestingPoolManager,
    };
  });

  const setupTestsWithMock = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['ShutterToken', 'VestingLibrary', 'VestingPool']);
    const executor = await getExecutor();
    const airdropContract = await getAirdropContract();
    const vestingLibraryContract = await getVestingLibraryContract();
    const vestingLibrary = await vestingLibraryContract.deploy();
    const poolContract = await getVestingPoolContract(vestingLibrary.address);
    const vestingPoolManagerContract = await getVestingPoolManagerContract();
    const tokenContract = await getTestTokenContract();
    // const token = await deployTestToken(poolManager.address);
    const mock = await getMock();
    const token = tokenContract.attach(mock.address);
    const pool = await poolContract.deploy();

    const vestingPoolManager = await vestingPoolManagerContract.deploy(
      token.address,
      pool.address,
      executor.address,
    );

    const airdrop = await airdropContract.deploy(
      token.address,
      executor.address,
      redeemDeadline,
      vestingPoolManager.address,
    );

    return {
      token,
      pool,
      vestingPoolManager,
      vestingLibrary,
      executor,
      mock,
      airdrop
    };
  });

  const createVesting = (account: string, amount: BigNumber, initialUnlock: BigNumber = BigNumber.from(0)): Vesting => {
    return {
      owner: account,
      curveType: 0,
      managed: false,
      durationWeeks: 208,
      startDate: vestingStart,
      amount,
      initialUnlock: initialUnlock,
    };
  };

  const generateAirdrop = async (
    amount: BigNumber,
    initialUnlock: BigNumber = BigNumber.from(0),
  ): Promise<{
    root: string;
    elements: string[];
  }> => {
    const elements = users
      .map(u => u.address)
      .map((account: string) => {
        return createVesting(account, amount, initialUnlock);
      })
      .map((vesting: Vesting) => {
        return calculateVestingHash(vesting);
      });
    const root = generateRoot(elements);
    return {
      root,
      elements,
    };
  };

  describe('redeem', async () => {
    it('should revert if root not set', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const vesting = createVesting(user1.address, amount);
      await expect(
        airdrop.redeem(
          vesting.curveType,
          vesting.durationWeeks,
          vesting.startDate,
          vesting.amount,
          vesting.initialUnlock,
          [],
        ),
      ).to.be.revertedWith('State root not initialized');
    });

    it('should revert with invalid proof', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { root, elements } = await generateAirdrop(amount);
      await airdrop.initializeRoot(root);
      await token.transfer(airdrop.address, amount);
      const vesting = createVesting(user1.address, amount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);
      proof.pop();
      await expect(
        airdrop.redeem(
          vesting.curveType,
          vesting.durationWeeks,
          vesting.startDate,
          vesting.amount,
          vesting.initialUnlock,
          proof,
        ),
      ).to.be.revertedWith('Invalid merkle proof');
    });

    it('should revert if not redeemed by vesting owner', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { root, elements } = await generateAirdrop(amount);
      await airdrop.initializeRoot(root);
      await token.transfer(airdrop.address, amount);
      const vesting = createVesting(user2.address, amount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);
      proof.pop();
      await expect(
        airdrop.redeem(
          vesting.curveType,
          vesting.durationWeeks,
          vesting.startDate,
          vesting.amount,
          vesting.initialUnlock,
          proof,
        ),
      ).to.be.revertedWith('Invalid merkle proof');
    });

    it('should revert if redeemed twice', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { root, elements } = await generateAirdrop(amount);
      await airdrop.initializeRoot(root);
      await token.transfer(airdrop.address, amount.mul(elements.length));
      const vesting = createVesting(user1.address, amount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);
      await airdrop
        .connect(user1)
        .redeem(
          vesting.curveType,
          vesting.durationWeeks,
          vesting.startDate,
          vesting.amount,
          vesting.initialUnlock,
          proof,
        );
      await expect(
        airdrop
          .connect(user1)
          .redeem(
            vesting.curveType,
            vesting.durationWeeks,
            vesting.startDate,
            vesting.amount,
            vesting.initialUnlock,
            proof,
          ),
      ).to.be.revertedWith('Vesting id already used');
    });

    it('should revert if redeemed after deadline', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { root, elements } = await generateAirdrop(amount);
      await airdrop.initializeRoot(root);
      await token.transfer(airdrop.address, amount);
      const vesting = createVesting(user1.address, amount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);
      await setNextBlockTime(redeemDeadline + 1);
      await expect(
        airdrop.redeem(
          vesting.curveType,
          vesting.durationWeeks,
          vesting.startDate,
          vesting.amount,
          vesting.initialUnlock,
          proof,
        ),
      ).to.be.revertedWith('Deadline to redeem vesting has been exceeded');
    });

    it('will add vesting', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { root, elements } = await generateAirdrop(amount);
      await airdrop.initializeRoot(root);
      await token.transfer(airdrop.address, amount);
      const vesting = createVesting(user1.address, amount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);
      await expect(
        airdrop
          .connect(user1)
          .redeem(
            vesting.curveType,
            vesting.durationWeeks,
            vesting.startDate,
            vesting.amount,
            vesting.initialUnlock,
            proof,
          ),
      )
        .to.emit(airdrop, 'RedeemedVesting')
        .withArgs(vestingHash, user1.address);
    });

    it('can redeem all vestings', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { root, elements } = await generateAirdrop(amount);
      await airdrop.initializeRoot(root);
      await token.transfer(airdrop.address, amount.mul(users.length));
      for (const user of users) {
        const vesting = createVesting(user.address, amount);
        const vestingHash = calculateVestingHash(vesting);
        const proof = generateProof(elements, vestingHash);
        await expect(
          airdrop
            .connect(user)
            .redeem(
              vesting.curveType,
              vesting.durationWeeks,
              vesting.startDate,
              vesting.amount,
              vesting.initialUnlock,
              proof,
            ),
        )
          .to.emit(airdrop, 'RedeemedVesting')
          .withArgs(vestingHash, user.address);
      }
      expect(await token.balanceOf(airdrop.address)).to.be.eq(0);
    });

    it("should be able to withdraw initialUnlock", async () => {
      const { airdrop, token, vestingPoolManager } = await setupTests();
      const amount = ethers.utils.parseUnits("200000", 18)
      const initialUnlockAmount = ethers.utils.parseUnits("100000", 18)
      const { root, elements } = await generateAirdrop(amount, initialUnlockAmount)
      await airdrop.initializeRoot(root)
      await token.transfer(airdrop.address, amount)
      const vesting = createVesting(user1.address, amount, initialUnlockAmount)
      const vestingHash = calculateVestingHash(vesting)
      const proof = generateProof(elements, vestingHash)

      expect(await token.balanceOf(user1.address)).to.be.eq(0)
      await expect(
        airdrop.connect(user1).redeem(
          vesting.curveType,
          vesting.durationWeeks,
          vesting.startDate,
          vesting.amount,
          vesting.initialUnlock,
          proof
        )
      )
        .to.emit(airdrop, "RedeemedVesting").withArgs(vestingHash, user1.address)

      expect(await token.balanceOf(user1.address)).to.be.eq(0)
      // get user's proxy
      const proxy = await getUserVestingProxy(vestingPoolManager, user1.address)

      // move chain to vesting startdate
      await setNextBlockTime(vesting.startDate)

      // claim
      await expect(proxy.connect(user1).claimVestedTokens(vestingHash, user1.address, initialUnlockAmount))
        .to.emit(proxy, 'ClaimedVesting')

      expect(await token.balanceOf(user1.address)).to.be.eq(initialUnlockAmount)
    });

    const setupAirdrop = async (
      airdrop: Contract,
      token: Contract,
      amount: BigNumber = ethers.utils.parseUnits("200000", 18),
      executor?: Contract
    ): Promise<string[]> => {
      const { root, elements } = await generateAirdrop(amount)
      if (executor) {
        const initData = airdrop.interface.encodeFunctionData("initializeRoot", [root])
        await executor.exec(airdrop.address, 0, initData,0)
      } else {
        await airdrop.initializeRoot(root)
      }
      await token.transfer(airdrop.address, amount)
      return elements
    }

    it("should be able to redeem even if token is paused", async () => {
      const { airdrop, token, mock, executor, vestingPoolManager } = await setupTestsWithMock();
      await executor.enableModule(vestingPoolManager.address);
      const amount = ethers.utils.parseUnits("200000", 18)
      await mock.givenMethodReturnUint(token.interface.getSighash('balanceOf'), amount);
      await mock.givenMethodReturnBool(token.interface.getSighash('paused'), true);
      const elements = await setupAirdrop(airdrop, token, amount, executor)

      const vesting = createVesting(user1.address, amount)
      const vestingHash = calculateVestingHash(vesting)
      const proof = generateProof(elements, vestingHash)

      await token.pause()
      await token.transferOwnership(executor.address);

      await expect(
        airdrop.connect(user1).redeem(
          vesting.curveType,
          vesting.durationWeeks,
          vesting.startDate,
          vesting.amount,
          vesting.initialUnlock,
          proof
        )
      )
        .to.emit(airdrop, "RedeemedVesting").withArgs(vestingHash, user1.address)


      const proxy = await getUserVestingProxy(vestingPoolManager, user1.address)

      expect(await token.balanceOf(proxy.address)).to.be.eq(amount)
    });
  });
});
