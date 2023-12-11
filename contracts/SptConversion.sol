// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Airdrop } from "./Airdrop.sol";
import { VestingPoolManager } from "./VestingPoolManager.sol";

contract SptConversion is Airdrop {
    address public immutable SPT;

    constructor(
        address _token,
        address _manager,
        uint64 _redeemDeadline,
        address _vestingPoolManager,
        bytes32 _root,
        address _sptToken
    ) Airdrop(_token, _manager, _redeemDeadline, _vestingPoolManager, _root) {
        SPT = _sptToken;
    }

    function redeem(
        uint8 curveType,
        uint16 durationWeeks,
        uint64 startDate,
        uint128 amount,
        uint128 initialUnlock,
        bytes32[] calldata proof
    ) public override {
        require(
            IERC20(SPT).transferFrom(msg.sender, address(this), amount),
            "SPT transfer failed"
        );
        super.redeem(
            curveType,
            durationWeeks,
            startDate,
            amount,
            initialUnlock,
            proof
        );
    }
}
