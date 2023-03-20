#!/usr/bin/env zx
/* eslint-disable no-multiple-empty-lines */
/* eslint-disable no-useless-escape */
/* eslint-disable operator-linebreak */
/* eslint-disable prefer-template */
/* eslint-disable semi */
/* eslint-disable no-undef */

const IMAGE_REG = /writing image sha256:([0-9a-z]+)\ done/

async function bundleApp() {
    console.log(chalk.gray('打包 openai-chat-srv'));
    await $`rm -rf dist && mkdir dist`;
    ['MP_verify_ucmvXzViscnLif9o.txt', 'bin', 'src', '.dockerignore', 'Dockerfile', 'package.json', 'package-lock.json', 'settings.js']
        .forEach(async (f) => {
            await $`cp -r ${f} ./dist/`;
        });
    console.log(chalk.gray('打包 openai-chat-srv 完成'));
}

async function checkGitStatus() {
    console.log(chalk.gray('检查 git 状态'))
    const out = (await $`git status -s`.quiet()).toString()
    if (out.split('\n').length > 1) {
        console.log(chalk.red('运行此脚本需要保证代码全部 git commit'))
        await $`exit 1`.quiet()
    }
    console.log(chalk.gray('代码已经全部提交'))
}


$.cwd = path.join(__dirname, '..')

async function dockerBuild() {
    $.cwd = path.join(__dirname, '../dist')
    const out = await $`docker build .`
    const a = out
        .toString()
        .split('\n')
        .find(l => IMAGE_REG.test(l))
    if (!a) {
        console.log(chalk.red('没有构建成功的 image id'))
        await $`exit 1`.quiet()
    } else {
        console.log(chalk.yellow(a))
    }
    return a
}

async function dockerTagAndPush(a) {
    const imageId = a.match(IMAGE_REG)[1]
    const head = (await $`git rev-parse --short HEAD`.quiet()).toString().split('\n')[0]
    const tagged = `ccr.ccs.tencentyun.com/flowda-test/openai-chat-srv:${head}`
    await $`docker tag ${imageId} ${tagged}`
    await $`docker push ${tagged}`
    const gb = (await $`git rev-parse --abbrev-ref HEAD`.quiet()).toString()
    const branch = gb.split('\n')[0]
    console.log(chalk.green('docker push 成功'))

    console.log(
        chalk.bgYellow.bold(
            '请在发布记录里粘贴 https://webinfra.yuque.com/wkur41/gsmrmc/oga5gxnc2av2piq2/edit',
        ),
    )
    const m = new Date()
    const dateString =
        m.getUTCFullYear() +
        '/' +
        (m.getUTCMonth() + 1) +
        '/' +
        m.getUTCDate() +
        ' ' +
        m.getUTCHours() +
        ':' +
        m.getUTCMinutes() +
        ':' +
        m.getUTCSeconds()
    console.log(`
## openai-chat-srv ${dateString}
是否 deploy: 否
镜像是否删除：否
分支：${branch}
commit: ${head}
Docker 镜像：${tagged}
时间：${dateString}
腾讯云镜像地址：https://console.cloud.tencent.com/tcr/repository
`)
}

try {
    await checkGitStatus()
    await bundleApp()
    await $`docker login ccr.ccs.tencentyun.com --username=100028622516`
    await within(async () => {
        const a = await dockerBuild()
        console.log('docker build: ', a)
        await dockerTagAndPush(a)
    })
} catch (p) {
    console.log(chalk.red(`Exit code: ${p.exitCode}`))
    console.log(chalk.red(`Error: ${p.stderr}`))
}
