import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { Staking } from '../wrappers/Staking';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { MockMinter } from '../wrappers/MockMinter';
import { MockWallet } from '../wrappers/MockWallet';

describe('Staking', () => {
    let stakingCode: Cell;
    let jettonMinterCode: Cell;
    let jettonWalletCode: Cell;
    let nftCode: Cell;

    beforeAll(async () => {
        stakingCode = await compile('Staking');
        jettonMinterCode = await compile('MockMinter');
        jettonWalletCode = await compile('MockWallet');
        nftCode = await compile('NftItem');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let staking: SandboxContract<Staking>;
    let admin: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let jettonMinter: SandboxContract<MockMinter>;
    let userJettonWallet: SandboxContract<MockWallet>;
    let stakingJettonWallet: SandboxContract<MockWallet>;
    let adminJettonWallet: SandboxContract<MockWallet>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        admin = await blockchain.treasury('admin');
        user = await blockchain.treasury('user');

        staking = blockchain.openContract(
            Staking.createFromConfig(
                {
                    owner: admin.address,
                    percentYear: 3650000000n,
                    lockupPeriod: 10,
                    collectionContent: '',
                    commonContent: '',
                    nftItemCode: nftCode,
                    royaltyParams: beginCell()
                        .storeUint(12, 16)
                        .storeUint(100, 16)
                        .storeAddress(admin.address)
                    .endCell()
                }, 
                stakingCode
            )
        );

        jettonMinter = blockchain.openContract(
            MockMinter.createFromConfig(
                {
                    adminAddress: admin.address,
                    content: new Cell(),
                    jettonWalletCode: jettonWalletCode
                },
                jettonMinterCode
            )
        );

        deployer = await blockchain.treasury('deployer');

        await jettonMinter.sendDeploy(deployer.getSender(), toNano('0.05'))

        expect((await blockchain.getContract(jettonMinter.address)).accountState?.type === 'active')

        await jettonMinter.sendMint(admin.getSender(), {
            toAddress: user.address,
            jettonAmount: toNano('10000')
        })

        await jettonMinter.sendMint(admin.getSender(), {
            toAddress: admin.address,
            jettonAmount: toNano('10000')
        })

        userJettonWallet = blockchain.openContract(
            MockWallet.createFromAddress(await jettonMinter.getWalletAddress(user.address))
        )

        adminJettonWallet = blockchain.openContract(
            MockWallet.createFromAddress(await jettonMinter.getWalletAddress(admin.address))
        )

        stakingJettonWallet = blockchain.openContract(
            MockWallet.createFromAddress(await jettonMinter.getWalletAddress(staking.address))
        )

        const deployResult = await staking.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: staking.address,
            deploy: true,
            success: true,
        });
    });

    it('should set jetton wallet address', async () => {
        const setJettonWalletAddressWrongSenderResult = await staking.sendSetJettonWalletAddress(user.getSender(), stakingJettonWallet.address)

        expect(setJettonWalletAddressWrongSenderResult.transactions).toHaveTransaction({
            from: user.address,
            to: staking.address,
            success: false,
            exitCode: 0xffff
        })

        const setJettonWalletAddressResult = await staking.sendSetJettonWalletAddress(admin.getSender(), stakingJettonWallet.address)

        expect(setJettonWalletAddressResult.transactions).toHaveTransaction({
            from: admin.address,
            to: staking.address,
            success: true
        })

        expect(await staking.getJettonWalletAddress()).toEqualAddress(stakingJettonWallet.address)
    });

    it('should top up jetton balance', async () => {
        await staking.sendSetJettonWalletAddress(admin.getSender(), stakingJettonWallet.address)
        const topUpJettonBalance = await adminJettonWallet.sendTransfer(admin.getSender(), {
            toAddress: staking.address,
            jettonAmount: toNano('1000'),
            fwdAmount: toNano('0.05'),
            fwdPayload: beginCell()
                .storeUint(0x77b2286b, 32)
            .endCell()
        });

        expect(topUpJettonBalance.transactions).toHaveTransaction({
            from: admin.address,
            to: adminJettonWallet.address,
            op: 0xf8a7ea5,
            success: true,
            outMessagesCount: 1
        })

        expect(topUpJettonBalance.transactions).toHaveTransaction({
            from: adminJettonWallet.address,
            to: stakingJettonWallet.address,
            op: 0x178d4519,
            success: true,
            outMessagesCount: 2,
            deploy: true
        })

        expect(topUpJettonBalance.transactions).toHaveTransaction({
            from: stakingJettonWallet.address,
            to: staking.address,
            op: 0x7362d09c,
            success: true,
            value: toNano('0.05')
        })

        expect((await blockchain.getContract(stakingJettonWallet.address)).accountState?.type === 'active')
        expect((await staking.getStakingData()).totalReward).toEqual(toNano('1000'))
        expect(await stakingJettonWallet.getJettonBalance()).toEqual(toNano('1000'))
    })

    it('should process stake request', async () => {
        await staking.sendSetJettonWalletAddress(admin.getSender(), stakingJettonWallet.address)

        await adminJettonWallet.sendTransfer(admin.getSender(), {
            toAddress: staking.address,
            jettonAmount: toNano('1000'),
            fwdAmount: toNano('0.05'),
            fwdPayload: beginCell()
                .storeUint(0x77b2286b, 32)
            .endCell()
        });

        const transferResult = await userJettonWallet.sendTransfer(user.getSender(), {
            toAddress: staking.address,
            jettonAmount: toNano('1000'),
            fwdAmount: toNano('0.05')
        })

        expect(transferResult.transactions).toHaveTransaction({
            from: stakingJettonWallet.address,
            to: staking.address,
            op: 0x7362d09c,
            success: true,
            value: toNano('0.05'),
            outMessagesCount: 1
        })

        const nftAddress = await staking.getNftAddressByIndex(0n);

        expect(transferResult.transactions).toHaveTransaction({
            from: staking.address,
            to: nftAddress,
            success: true,
            deploy: true
        })

        expect((await blockchain.getContract(nftAddress)).accountState?.type === 'active')
        expect((await staking.getCollectionData()).nextItemIndex).toEqual(1n)
        expect((await staking.getStakingData()).currentReward).toEqual(toNano('100'))
        expect((await staking.getStakingData()).totalReward).toEqual(toNano('1000') + toNano('1000'))

        printTransactionFees(transferResult.transactions)
    })
});
