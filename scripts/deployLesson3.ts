import { Address, toNano } from '@ton/core';
import { Lesson3 } from '../wrappers/Lesson3';
import { compile, NetworkProvider } from '@ton/blueprint';
import { randomAddress } from '@ton/test-utils';

export async function run(provider: NetworkProvider) {
    const contract = provider.open(Lesson3.createFromConfig({
        receiver: randomAddress(),
        admin: provider.sender().address as Address
    }, await compile('Lesson3')));

    await contract.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(contract.address);
}
