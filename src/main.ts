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
        forEach((dom) => gameDom.appendChild(dom)),
    )(initBlockNum);

    return blocks.length;
});

const createAppleIO = (gameDom: HTMLDivElement) => RF.IO((): Position => {
    if (!gameDom) return [0, 0];

    const x = getRandom(0, (gameDom.clientWidth - 20) / BLOCK_SIZE);
    const y = getRandom(0, (gameDom.clientHeight - 20) / BLOCK_SIZE);

    const $apple = initDom(x, y, createApple());

    gameDom.appendChild($apple);

    return [x, y];
});

const updateAppleCountIO = (() => {
    const appleCountDom = document.querySelector('.score-num');
    return (count: number) => RF.IO(() => {
        if (appleCountDom) appleCountDom.innerHTML = String(count);
    });
})();

const handlePosFromDirection = (() => {
    const gameDom = document.querySelector('.game');
    if (!gameDom) return () => {};
    const xEnd = gameDom.clientWidth / BLOCK_SIZE;
    const yEnd = gameDom.clientHeight / BLOCK_SIZE;
    const getPos = (x: number, y: number, direct: KeyBoardCode) => {
        if (direct === KeyBoardCode.down) return [x, y + 1];
        if (direct === KeyBoardCode.up) return [x, y - 1];
        if (direct === KeyBoardCode.left) return [x - 1, y];
        if (direct === KeyBoardCode.right) return [x + 1, y];
        return [x, y];
    };

    return (x: number, y: number, direct: KeyBoardCode) => {
        const newPos = getPos(x, y, direct);
        if (newPos[0] < 0) newPos[0] = xEnd - 1;
        else if (newPos[0] >= xEnd) newPos[0] = 0;
        else if (newPos[1] < 0) newPos[1] = yEnd - 1;
        else if (newPos[1] >= yEnd) newPos[1] = 0;

        return newPos;
    };
})();

const getNewMovePos = (direct: KeyBoardCode, posArr: Position[], snakeLen: number) => pipe(
    clone,
    (o) => [...o, handlePosFromDirection(...posArr[posArr.length - 1], direct)],
    slice(-snakeLen, Infinity),
)(posArr) as Position[];

const getBlockDomsIO = (gameDom: HTMLDivElement) => new RF.IO(() => gameDom.querySelectorAll<HTMLDivElement>(`.${BLOCK_CLASS}`));

const addSnakeTailIO = (snakePosArr: Position[], gameDom: HTMLDivElement) => RF.IO(() => {
    const tailPos = snakePosArr[0];
    const snakeTail = initDom(...tailPos, createSnakeBlock());
    gameDom.appendChild(snakeTail);
});

const clearAppleIO = (gameDom: HTMLDivElement) => RF.IO(() => {
    gameDom.querySelectorAll(`.${APPLE_CLASS}`).forEach((o) => o.remove());
});

const hasSameCode = curryN(3, (arr1: unknown[], ...arr2: unknown[]) => arr2.every((o) => arr1.includes(o)));
const isSamePos = curry((pos1: Position, pos2: Position) => pos1[0] === pos2[0] && pos1[1] === pos2[1]);
const keyCodeIncludes = partialRight(includes, [values(KeyBoardCode)]);
const inContrastToLast = (lastKey: KeyBoardCode) => either(hasSameCode(VerticalCode, lastKey), hasSameCode(HorizonalCode, lastKey));

const $keyDown = RX.fromEvent(window, 'keydown').pipe(
    RX.map<Event, KeyBoardCode>((ev: any) => ev.code as KeyBoardCode),
    RX.scan(([, lastCode], code) => [lastCode, code], [KeyBoardCode.no, KeyBoardCode.no]),
    RX.filter(([lastCode, code]) => !anyPass<KeyBoardCode>([
        pipe(keyCodeIncludes, not),
        equals(lastCode),
        inContrastToLast(lastCode),
    ])(code)),
    RX.map(([, code]) => code),
);

const autoMove = (gameDom: HTMLDivElement, snakePos: Position[], applePos: Position, appleCount: number, goingKey = KeyBoardCode.no) => {
    const $observable = new RX.Observable((sub) => {
        sub.next(goingKey);
        $keyDown.subscribe(sub);
    });

    const $move = RX.combineLatest([
        RX.interval(MOVE_SPEED * 0.8 ** appleCount), // 蛇加速
        appleCount > 0 ? $observable : $keyDown,
    ]).pipe(
        RX.map(([, key]) => key as KeyBoardCode),
        RX.scan<KeyBoardCode, [Position[], KeyBoardCode]>(([posArr], key) => [getNewMovePos(key, posArr, snakePos.length + 1), key], [snakePos, KeyBoardCode.no]),
    );

    // 移动蛇
    const moveSub = $move.subscribe(([posArr]) => {
        const $blockDoms = getBlockDomsIO(gameDom).runIO();
        posArr.forEach((pos, i) => moveDom(...pos, $blockDoms[i]));
    });

    // eslint-disable-next-line no-unused-vars
    const isCrashApple: (_: Position[]) => boolean = pipe(last, isSamePos(applePos));

    // 判断蛇是否碰撞到苹果
    const crashSub = $move.pipe(
        RX.filter(([posArr]) => isCrashApple(posArr)),
    ).subscribe(([posArr, key]) => {
        clearAppleIO(gameDom).runIO();
        addSnakeTailIO(posArr, gameDom).runIO();
        updateAppleCountIO(appleCount).runIO();
        const newApplePos = createAppleIO(gameDom).runIO();

        moveSub.unsubscribe();
        crashSub.unsubscribe();

        autoMove(gameDom, posArr, newApplePos, appleCount + 1, key);
    });
};

const initGameIO = (gameDom: HTMLDivElement) => RF.IO(() => {
    const initSnakePos = initSnake(gameDom, INIT_BLOCK_NUM)
        .map((len) => range(0, len - 1))
        .map<Position[]>(map((i) => [0, i]))
        .runIO();
    const appleCreator = createAppleIO(gameDom);
    autoMove(gameDom, initSnakePos, appleCreator.runIO(), 0);
});

const __main = () => {
    const $game = document.querySelector<HTMLDivElement>('.game');

    if (!$game) return;

    initGameIO($game).runIO();
};

__main();
