import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { ShutterToken, ShutterToken__factory, } from "../typechain";

describe("Shutter Token", async function() {
  let owner: SignerWithAddress;
  let shutterToken: ShutterToken;

  const mintWhole = 1_000_000_000;
  const mintTotal = ethers.utils.parseEther(mintWhole.toString());

  beforeEach(async function() {
    [owner] = await ethers.getSigners();

    shutterToken = await new ShutterToken__factory(owner).deploy(
      owner.address
    );
  });

  describe("Token features", function() {
    describe("Minting the correct amount of tokens at deployment", function() {
      let totalSupply: BigNumber;

      beforeEach(async function() {
        totalSupply = await shutterToken.totalSupply();
      });

      it("Should mint the correct amount of tokens in wei (decimals)", async function() {
        expect(totalSupply).to.equal(mintTotal);
      });

      it("Should mint the correct amount of tokens in whole numbers", async function() {
        expect(parseInt(ethers.utils.formatEther(totalSupply))).to.eq(
          mintWhole
        );
      });
    });

  });
});
