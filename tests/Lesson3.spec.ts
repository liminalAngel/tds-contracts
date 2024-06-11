import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Lesson3 } from '../wrappers/Lesson3';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Main', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Lesson3');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let contract: SandboxContract<Lesson3>;
    let receiver: SandboxContract<TreasuryContract>;
    let admin: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        receiver = await blockchain.treasury('receiver');
        admin = await blockchain.treasury('admin');
        user = await blockchain.treasury('user');

        contract = blockchain.openContract(Lesson3.createFromConfig({
            receiver: receiver.address,
            admin: admin.address
        }, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await contract.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: contract.address,
            deploy: true,
            success: true,
        });
    });

    it('should send funds to receiver', async () => {
        const userBalanceBefore = await user.getBalance();
        const receiverBalanceBefore = await receiver.getBalance();

        const sendFundsResult = await contract.sendFunds(user.getSender(), toNano('1'))
        expect(sendFundsResult.transactions).toHaveTransaction({
            from: user.address,
            to: contract.address,
            success: true,
            outMessagesCount: 1,
            op: 0x6f074817,
            value: toNano('1')
        });

        expect(sendFundsResult.transactions).toHaveTransaction({
            from: contract.address,
            to: receiver.address,
            success: true,
            value: toNano('1')
        })
        const userBalanceAfter = await user.getBalance();
        const receiverBalanceAfter = await receiver.getBalance();

        expect(userBalanceAfter).toBeLessThan(userBalanceBefore);
        expect(receiverBalanceAfter).toBeGreaterThan(receiverBalanceBefore)

        printTransactionFees(sendFundsResult.transactions)
    });

    it('should throw 100 in case msg_value is less than 1 TON', async () => {
        const sendFundsResult = await contract.sendFunds(user.getSender(), toNano('0.1'))
        expect(sendFundsResult.transactions).toHaveTransaction({
            from: user.address,
            to: contract.address,
            success: false,
            op: 0x6f074817,
            value: toNano('0.1'),
            exitCode: 100
        });

        expect(sendFundsResult.transactions).toHaveTransaction({
            from: contract.address,
            to: user.address,
            inMessageBounced: true
        })

        printTransactionFees(sendFundsResult.transactions)
    })

    it('should lock and unlock', async () => {
        expect(await contract.getIsLocked()).toEqual(0);
        const sendLockResult = await contract.sendLock(admin.getSender());

        expect(sendLockResult.transactions).toHaveTransaction({
            from: admin.address,
            to: contract.address,
            success: true,
            op: 0x878f9b0e
        })

        expect(await contract.getIsLocked()).toEqual(1);

        const sendFundsResult = await contract.sendFunds(user.getSender(), toNano('1'))
        expect(sendFundsResult.transactions).toHaveTransaction({
            from: user.address,
            to: contract.address,
            success: false,
            exitCode: 99
        });

        const sendUnlockWrongSenderResult = await contract.sendUnlock(user.getSender())
        expect(sendUnlockWrongSenderResult.transactions).toHaveTransaction({
            from: user.address,
            to: contract.address,
            success: false,
            exitCode: 101
        })

        expect(await contract.getIsLocked()).toEqual(1);

        const sendUnlockResult = await contract.sendUnlock(admin.getSender())
        expect(sendUnlockResult.transactions).toHaveTransaction({
            from: admin.address,
            to: contract.address,
            success: true
        })

        expect(await contract.getIsLocked()).toEqual(0);
    })
});
