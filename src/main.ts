import './style/reset.less';
import './style.less';

import * as RF from 'ramda-fantasy';
import {
    anyPass,
    both,
    clone, curry, curryN, defaultTo, equals, forEach, includes, last, map, not, partialRight, pipe, range, values,
} from 'ramda';
import { getRandom } from './tools';
import { KeyBoardCode } from './difinition';

type Position = [number, number]

const BLOCK_SIZE = 20;
const INIT_BLOCK_NUM = 6;
const APPLE_CLASS = 'apple';
const BLOCK_CLASS = 'snake-block';
const MOVE_SPEED = 100;
const VerticalCode = [KeyBoardCode.up, KeyBoardCode.down];
const HorizonalCode = [KeyBoardCode.left, KeyBoardCode.right];

const createSnakeBlock = (): HTMLDivElement => {
    const $div = document.createElement('div');
    $div.classList.add(BLOCK_CLASS);
    return $div;
};

const createApple = () => {
    const $div = document.createElement('div');
    $div.classList.add(APPLE_CLASS);
    return $div;
};

const moveDom = (x: number, y: number, dom: HTMLDivElement): HTMLDivElement => {
    dom.style.top = `${y * BLOCK_SIZE}px`;
    dom.style.left = `${x * BLOCK_SIZE}px`;
    return dom;
};

const initDom = (x: number, y: number, dom: HTMLDivElement) => moveDom(x, y, dom);

const initSnake = (gameDom: HTMLDivElement, initBlockNum: number) => RF.IO(() => {
    const blocks = pipe(
        range(0),
        map((i) => RF.IO(() => initDom(0, i, createSnakeBlock()))),
        forEach((io) => gameDom.appendChild(io.runIO())),
    )(initBlockNum);

    return blocks.length;
});

const initAppleIO = (gameDom: HTMLDivElement | null) => RF.IO((): Position => {
    if (!gameDom) return [0, 0];

    const x = getRandom(0, gameDom.offsetWidth / BLOCK_SIZE);
    const y = getRandom(0, gameDom.offsetHeight / BLOCK_SIZE);

    const $apple = initDom(x, y, createApple());

    gameDom.appendChild($apple);

    return [x, y];
});

const handlePosFromDirection = (x: number, y: number, direct: KeyBoardCode): Position => {
    if (direct === KeyBoardCode.down) return [x, y + 1];
    if (direct === KeyBoardCode.up) return [x, y - 1];
    if (direct === KeyBoardCode.left) return [x - 1, y];
    if (direct === KeyBoardCode.right) return [x + 1, y];
    return [x, y];
};

const autoMoveIO = (direct: KeyBoardCode, posArr: Position[]) => RF.IO(() => {
    const retPosArr = clone(posArr);
    document.querySelectorAll<HTMLDivElement>(`.${BLOCK_CLASS}`).forEach((d, i) => {
        const trackIndex = posArr.length - i;
        const pos = posArr[trackIndex];
        if (pos) {
            moveDom(...pos, d);
        } else {
            const newPos = handlePosFromDirection(...posArr[trackIndex - 1], direct);
            moveDom(...newPos, d);
            retPosArr.push(newPos);
        }
    });
    return retPosArr;
});

const addSnakeTailIO = (snakePosArr: Position[], gameDom: HTMLDivElement) => RF.IO(() => {
    const snakeLength = gameDom.querySelectorAll<HTMLDivElement>(`.${BLOCK_CLASS}`).length;
    const tailPos = snakePosArr[snakePosArr.length - snakeLength];
    const tail = initDom(...tailPos, createSnakeBlock());
    gameDom.appendChild(tail);
});

const clearAppleIO = (gameDom: HTMLDivElement) => RF.IO(() => {
    gameDom.querySelectorAll(`.${APPLE_CLASS}`).forEach((o) => o.remove());
});

const hasSameCode = curryN(3, (arr1: unknown[], ...arr2: unknown[]) => arr2.every((o) => arr1.includes(o)));
const isSamePos = curry((pos1: Position, pos2: Position) => pos1[0] === pos2[0] && pos1[1] === pos2[1]);
const keyCodeIncludes = partialRight(includes, [values(KeyBoardCode)]);
const inContrastToLast = (lastKey: string) => both(hasSameCode(VerticalCode, lastKey), hasSameCode(HorizonalCode, lastKey));

const initGameIO = (gameDom: HTMLDivElement) => RF.IO(() => {
    const appleCreator = initAppleIO(gameDom);

    let timer: number;
    let lastKeyCode: string;
    let snakePosArr = initSnake(gameDom, INIT_BLOCK_NUM)
        .map(range(0))
        .map(map((i) => [0, i]))
        .runIO() as Position[]; // 蛇的位置
    let applePos = appleCreator.runIO();

    snakePosArr = autoMoveIO(KeyBoardCode.down, snakePosArr).runIO();

    window.addEventListener('keydown', (e: any) => {
        const notPass = anyPass<string>([
            pipe(keyCodeIncludes, not),
            equals(lastKeyCode),
            inContrastToLast(lastKeyCode),
        ])(e.code);

        if (notPass) return;

        lastKeyCode = e.code;

        clearInterval(timer);
        timer = setInterval(() => {
            const isCrashApple = pipe(last, defaultTo([-1, -1]), isSamePos(applePos));
            snakePosArr = autoMoveIO(e.code, snakePosArr).runIO();

            if (isCrashApple(snakePosArr)) {
                clearAppleIO(gameDom).runIO();
                addSnakeTailIO(snakePosArr, gameDom).runIO();
                applePos = appleCreator.runIO();
            }
        }, MOVE_SPEED);
    });
});

const __main = () => {
    const $game = document.querySelector<HTMLDivElement>('.game');

    if (!$game) return;

    initGameIO($game).runIO();
};

__main();
