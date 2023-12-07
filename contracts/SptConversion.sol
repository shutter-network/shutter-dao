// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.22;

import "./Airdrop.sol";

contract SptConversion is Airdrop {
    address public constant SPT = 0x1;

    constructor(
        address _token,
        address _manager,
        uint64 _redeemDeadline,
        VestingPoolManager _vestingPoolManager
    ) Airdrop(_token, _manager, _redeemDeadline) {}

    function redeem(
        uint8 curveType,
        uint16 durationWeeks,
        uint64 startDate,
        uint128 amount,
        uint128 initialUnlock,
        bytes32[] calldata proof
    ) external {
        require(
            IERC20(SPT).transferFrom(msg.sender, amount),
            "SPT transfer failed"
        );
        super.redeem(curveType, durationWeeks, startDate, amount, initialUnlock, proof);
    }
}
