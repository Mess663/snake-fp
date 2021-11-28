import './style/reset.less';
import './style.less';

import * as RF from 'ramda-fantasy';
import {
    anyPass,
    clone, curry, curryN, either, equals, forEach, includes, last, map, not, partialRight, pipe, range, slice, values,
} from 'ramda';
import * as RX from 'rxjs';
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

const moveDom = curry((x: number, y: number, dom: HTMLDivElement): HTMLDivElement => {
    dom.style.top = `${y * BLOCK_SIZE}px`;
    dom.style.left = `${x * BLOCK_SIZE}px`;
    return dom;
});

const initDom = (x: number, y: number, dom: HTMLDivElement) => moveDom(x, y, dom);

const initSnake = (gameDom: HTMLDivElement, initBlockNum: number) => RF.IO(() => {
    const blocks = pipe(
        range(0),
        map((i) => initDom(0, i, createSnakeBlock())),
        forEach(gameDom.appendChild),
    )(initBlockNum);

    return blocks.length;
});

const initAppleIO = (gameDom: HTMLDivElement | null) => RF.IO((): Position => {
    if (!gameDom) return [0, 0];

    const x = getRandom(0, gameDom.clientWidth / BLOCK_SIZE);
    const y = getRandom(0, gameDom.clientHeight / BLOCK_SIZE);

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

const getNewMovePos = (direct: KeyBoardCode, posArr: Position[]) => pipe(
    clone,
    (o) => [...o, handlePosFromDirection(...posArr[posArr.length - 1], direct)],
)(posArr) as Position[];

const getBlockDomsIO = (gameDom: HTMLDivElement) => new RF.IO(() => gameDom.querySelectorAll<HTMLDivElement>(`.${BLOCK_CLASS}`));

const addSnakeTailIO = (snakePosArr: Position[], gameDom: HTMLDivElement) => RF.IO(() => {
    const snakeLength = getBlockDomsIO(gameDom).runIO().length;
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
const inContrastToLast = (lastKey: string) => either(hasSameCode(VerticalCode, lastKey), hasSameCode(HorizonalCode, lastKey));

const $keyDown = RX.fromEvent(window, 'keydown');
const $snakeMove = $keyDown.pipe(
    RX.concatMap((ev: any) => RX.interval(MOVE_SPEED).pipe(
        RX.scan(([, lastKey]) => [lastKey, ev.code], ['', ''] as unknown as KeyBoardCode[]),
        RX.takeUntil($keyDown),
    )),
    RX.filter(([lastKey, key]) => anyPass<KeyBoardCode>([
        pipe(keyCodeIncludes, not),
        equals(lastKey),
        inContrastToLast(lastKey),
    ])(key)),
    RX.map(([, key]) => key),
);

const initGameIO = (gameDom: HTMLDivElement) => RF.IO(() => {
    const appleCreator = initAppleIO(gameDom);

    const initSnakePos = initSnake(gameDom, INIT_BLOCK_NUM)
        .map(range(0))
        .map(map((i) => [0, i]))
        .runIO() as Position[];
    const $move = $snakeMove.pipe(RX.scan((posArr, key) => getNewMovePos(key, posArr), initSnakePos));

    $move.subscribe((posArr) => {
        const $blockDoms = getBlockDomsIO(gameDom).runIO();
        slice(-$blockDoms.length, Infinity, posArr).forEach((pos, i) => moveDom(...pos, $blockDoms[i]));
    });

    let applePos = appleCreator.runIO();
    $move.subscribe((posArr) => {
        const isCrashApple = pipe(last, isSamePos(applePos));
        if (isCrashApple(posArr)) {
            clearAppleIO(gameDom).runIO();
            addSnakeTailIO(posArr, gameDom).runIO();
            applePos = appleCreator.runIO();
        }
    });
});

const __main = () => {
    const $game = document.querySelector<HTMLDivElement>('.game');

    if (!$game) return;

    initGameIO($game).runIO();
};

__main();
