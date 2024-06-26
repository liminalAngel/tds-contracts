import { toNano } from '@ton/core';
import { Staking } from '../wrappers/Staking';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const staking = provider.open(Staking.createFromConfig({}, await compile('Staking')));

    await staking.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(staking.address);

    // run methods on `staking`
}
