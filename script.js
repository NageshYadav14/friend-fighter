/* ============================================
   THE NAGESHWAR GAMES — FRIEND FIGHTER
   Main JavaScript Game Engine
   ============================================ */

"use strict";


/* ============================================
   1. GAME CONFIGURATION
   ============================================ */

const CONFIG = {
    roundSeconds: 60,
    maxHealth: 100,

    punchDamage: 10,
    kickDamage: 18,
    specialDamage: 28,

    moveSpeed: 4.8,
    jumpHeight: 82,

    bestOf: 3,

    powerPerHit: 10,
    specialCost: 50,

    comboWindowMs: 4000,
    comboBonus: 8
};


/* ============================================
   2. CHARACTER DATABASE
   ============================================ */

const friends = [
    {
        name: "ABHICHANDRA",
        image: "images/abhichandra.jpeg"
    },
    {
        name: "ABHISHEK",
        image: "images/abhishek.jpeg"
    },
    {
        name: "AYAAN",
        image: "images/ayaan.jpeg"
    },
    {
        name: "JAY",
        image: "images/jay.jpeg"
    },
    {
        name: "NAGESHWAR",
        image: "images/nagesh.jpeg"
    }
];


/* ============================================
   3. HELPER FUNCTIONS
   ============================================ */

const $ = id => document.getElementById(id);

const screens = [
    "menuScreen",
    "selectScreen",
    "onlineScreen",
    "recordsScreen",
    "gameScreen"
];

function showScreen(id) {
    screens.forEach(screen => {
        $(screen).hidden = screen !== id;
    });
}

function safeText(value, max = 18) {
    return String(value || "").trim().slice(0, max);
}


/* ============================================
   4. SOUND SYSTEM
   ============================================ */

const audio = {
    punch: new Audio("sounds/punching.mp3.mp3"),
    kick: new Audio("sounds/kicking.mp3"),
    special: new Audio("sounds/special.mp3"),
    victory: new Audio("sounds/victory.mp3")
};

let soundEnabled = true;

Object.values(audio).forEach(a => {
    a.preload = "auto";
});

function playSound(name) {

    if (!soundEnabled || !audio[name]) return;

    const sound = audio[name];

    try {
        sound.pause();
        sound.currentTime = 0;

        const promise = sound.play();

        if (promise) {
            promise.catch(() => {});
        }

    } catch (error) {
        console.log("Sound error:", error);
    }
}

$("soundToggle").addEventListener("click", () => {

    soundEnabled = !soundEnabled;

    $("soundToggle").textContent =
        `SOUND: ${soundEnabled ? "ON" : "OFF"}`;

});


/* ============================================
   5. GAME INTERFACE ELEMENTS
   ============================================ */

const ui = {

    stage: $("stage"),

    banner: $("fightBanner"),

    overlay: $("resultOverlay"),

    timer: $("timer"),

    status: $("status"),

    hit: $("hitEffect")

};


/* ============================================
   6. PLAYER DATA
   ============================================ */

const player = {

    1: {
        id: 1,

        x: 70,
        y: 0,

        health: 100,
        power: 0,
        score: 0,

        facing: 1,

        jumping: false,
        crouching: false,
        blocking: false,
        attacking: false,

        comboHits: 0,
        lastComboHit: 0,

        element: $("fighter1"),
        name: $("fighterName1"),
        face: $("face1"),
        portrait: $("portrait1"),

        healthBar: $("health1"),
        healthText: $("healthText1"),
        powerBar: $("power1")
    },


    2: {
        id: 2,

        x: 0,
        y: 0,

        health: 100,
        power: 0,
        score: 0,

        facing: -1,

        jumping: false,
        crouching: false,
        blocking: false,
        attacking: false,

        comboHits: 0,
        lastComboHit: 0,

        element: $("fighter2"),
        name: $("fighterName2"),
        face: $("face2"),
        portrait: $("portrait2"),

        healthBar: $("health2"),
        healthText: $("healthText2"),
        powerBar: $("power2")
    }

};


let selected = {
    1: friends[1],
    2: friends[2]
};


let mode = "local";

let localOnlinePlayer = 0;

let roomCode = "";

let socket = null;

let isHost = false;

let gameRunning = false;

let roundTime = CONFIG.roundSeconds;

let timerId = null;

let rafId = null;

let roundNumber = 1;

let matchOver = false;

let keysDown = new Set();

let lastRoundWinner = 0;

let matchStartedAt = 0;


/* ============================================
   7. KEYBOARD CONTROLS
   ============================================ */

const keyMap = {

    // PLAYER 1

    a: [1, "left"],
    d: [1, "right"],
    w: [1, "jump"],
    s: [1, "crouch"],

    f: [1, "punch"],
    r: [1, "kick"],

    q: [1, "block"],
    e: [1, "special"],


    // PLAYER 2

    arrowleft: [2, "left"],
    arrowright: [2, "right"],
    arrowup: [2, "jump"],
    arrowdown: [2, "crouch"],

    "1": [2, "punch"],
    "2": [2, "kick"],

    "3": [2, "block"],
    "4": [2, "special"]

};


/* ============================================
   8. CHARACTER SELECTION
   ============================================ */

function setCharacter(number, character) {

    selected[number] = character;

    const p = player[number];

    p.name.textContent = character.name;

    p.face.src = character.image;

    p.portrait.src = character.image;

    p.portrait.alt = character.name;

}


function randomSelection() {

    const pool = [...friends].sort(
        () => Math.random() - 0.5
    );

    setCharacter(1, pool[0]);

    setCharacter(2, pool[1]);

}


function renderSelection() {

    [1, 2].forEach(number => {

        const grid = $(`characterGrid${number}`);

        grid.innerHTML = "";

        friends.forEach(character => {

            const button = document.createElement("button");

            button.className =
                "character-card" +
                (
                    selected[number].name === character.name
                        ? " selected"
                        : ""
                );


            const image = document.createElement("img");

            image.src = character.image;

            image.alt = character.name;


            const span = document.createElement("span");

            span.textContent = character.name;


            button.append(image, span);


            button.addEventListener("click", () => {

                selected[number] = character;

                updatePreview();

                renderSelection();

            });


            grid.appendChild(button);

        });

    });

    updatePreview();

}


function updatePreview() {

    [1, 2].forEach(number => {

        $(`preview${number}`).src = selected[number].image;

        $(`previewName${number}`).textContent =
            selected[number].name;

    });

}


/* ============================================
   9. HEALTH AND POWER HUD
   ============================================ */

function updateHud() {

    [1, 2].forEach(number => {

        const p = player[number];

        const hp = Math.max(0, p.health);

        p.healthBar.style.width = `${hp}%`;

        p.healthText.textContent = `${hp} HP`;

        p.powerBar.style.width = `${p.power}%`;

        $(`score${number}`).textContent = p.score;

    });


    $("roundLabel").textContent =
        `ROUND ${roundNumber} OF ${CONFIG.bestOf}`;

    ui.timer.textContent = roundTime;

}


/* ============================================
   10. CHARACTER RENDERING
   ============================================ */

function render() {

    const width = ui.stage.clientWidth || 800;

    const maxX = Math.max(0, width - 115);


    [1, 2].forEach(number => {

        const p = player[number];

        p.x = Math.max(
            0,
            Math.min(maxX, p.x)
        );

        p.element.style.left = `${p.x}px`;

        p.element.style.bottom = `${22 + p.y}px`;


        p.element.classList.toggle(
            "jumping",
            p.jumping
        );

        p.element.classList.toggle(
            "crouching",
            p.crouching
        );

        p.element.classList.toggle(
            "blocking",
            p.blocking
        );

    });


    if (player[1].x < player[2].x) {

        player[1].facing = 1;

        player[2].facing = -1;

    } else {

        player[1].facing = -1;

        player[2].facing = 1;

    }


    [1, 2].forEach(number => {

        const p = player[number];

        const flip =
            p.facing === -1
                ? "scaleX(-1)"
                : "scaleX(1)";


        p.element.querySelector(
            ".fighter-photo"
        ).style.transform = flip;


        p.element.querySelector(
            ".fighter-body"
        ).style.transform = flip;

    });

}


/* ============================================
   11. HIT EFFECTS AND COMBOS
   ============================================ */

function hitText(text, x) {

    ui.hit.textContent = text;

    ui.hit.style.left = `${Math.max(10, x)}px`;

    ui.hit.style.top = "45%";

    ui.hit.style.display = "block";


    clearTimeout(hitText.timeout);

    hitText.timeout = setTimeout(() => {

        ui.hit.style.display = "none";

    }, 550);

}


function comboText(number) {

    const element = document.createElement("div");

    element.className = "combo-message";

    element.textContent =
        `PLAYER ${number} — 3 HIT COMBO!`;

    ui.stage.appendChild(element);


    setTimeout(() => {

        element.remove();

    }, 750);

}


function showAttackAnimation(p, type, duration) {

    p.element.classList.remove(
        "punch",
        "kick",
        "special"
    );

    void p.element.offsetWidth;

    p.element.classList.add(type);


    setTimeout(() => {

        p.element.classList.remove(type);

    }, duration);

}


/* ============================================
   12. ATTACK RANGE
   ============================================ */

function isInRange(attacker, defender, range) {

    return (

        Math.abs(attacker.x - defender.x) <= range &&

        (defender.x - attacker.x) * attacker.facing > 0

    );

}


/* ============================================
   13. END ROUND
   ============================================ */

function endRound(winner) {

    if (!gameRunning) return;

    gameRunning = false;

    clearInterval(timerId);

    cancelAnimationFrame(rafId);

    lastRoundWinner = winner;


    if (winner === 1 || winner === 2) {

        player[winner].score++;

    }


    updateHud();


    const finished =

        player[1].score >= 2 ||

        player[2].score >= 2 ||

        roundNumber >= CONFIG.bestOf;


    // Synchronize online score from host

    if (
        mode === "online" &&
        socket?.connected &&
        localOnlinePlayer === 1
    ) {

        socket.emit("match:round-end", {

            roomCode,

            winner,

            score1: player[1].score,

            score2: player[2].score,

            roundNumber,

            finished

        });

    }


    const roundWinnerName = winner
        ? selected[winner].name
        : "DRAW";


    $("resultEyebrow").textContent = finished
        ? "MATCH COMPLETE"
        : `ROUND ${roundNumber} COMPLETE`;


    $("resultTitle").textContent = winner
        ? `${roundWinnerName} WINS!`
        : "IT'S A DRAW!";


    $("winnerPhoto").hidden = !winner;


    if (winner) {

        $("winnerPhoto").src = selected[winner].image;

    }


    $("resultMessage").textContent = finished

        ? (
            player[1].score === player[2].score

                ? "The championship ends in a draw."

                : `${selected[
                    player[1].score > player[2].score ? 1 : 2
                ].name} is the Friend Fighter champion!`
        )

        : `Score: ${player[1].score} — ${player[2].score}. Get ready for the next round.`;


    $("resultActionBtn").textContent = finished
        ? "SAVE RESULT & MENU"
        : "NEXT ROUND";


    $("resultActionBtn").onclick = () => {

        if (finished) {

            saveMatchResult();

            if (mode === "online" && socket?.connected) {

                socket.emit("match:finished", {

                    roomCode,

                    winner:
                        player[1].score === player[2].score
                            ? 0
                            : (
                                player[1].score > player[2].score
                                    ? 1
                                    : 2
                            ),

                    score1: player[1].score,

                    score2: player[2].score

                });

            }

            goMenu();

        } else {

            roundNumber++;

            startRound();

        }

    };


    $("resultMenuBtn").onclick = () => {

        if (finished) saveMatchResult();

        goMenu();

    };


    ui.overlay.hidden = false;


    if (finished) {

        playSound("victory");

    }


    $("status").textContent = finished
        ? "Championship finished."
        : "Round finished.";

}


/* ============================================
   14. PUNCH AND KICK SYSTEM
   ============================================ */

function attack(number, type) {

    if (!gameRunning) return;


    const attacker = player[number];

    const defender = player[number === 1 ? 2 : 1];


    if (attacker.attacking) return;

    attacker.attacking = true;


    const isKick = type === "kick";


    showAttackAnimation(
        attacker,
        type,
        isKick ? 440 : 300
    );


    playSound(
        isKick ? "kick" : "punch"
    );


    const range = isKick ? 155 : 120;


    if (isInRange(attacker, defender, range)) {

        let damage = isKick
            ? CONFIG.kickDamage
            : CONFIG.punchDamage;


        // BLOCKING REDUCES DAMAGE

        if (defender.blocking) {

            damage = Math.max(
                1,
                Math.round(damage * 0.3)
            );

            hitText("BLOCK!", defender.x);

        } else {

            const now = Date.now();


            attacker.comboHits =

                now - attacker.lastComboHit <= CONFIG.comboWindowMs

                    ? attacker.comboHits + 1

                    : 1;


            attacker.lastComboHit = now;


            // THREE HIT COMBO

            if (attacker.comboHits >= 3) {

                damage += CONFIG.comboBonus;

                attacker.comboHits = 0;

                comboText(number);

            }


            attacker.power = Math.min(
                100,
                attacker.power + CONFIG.powerPerHit
            );


            hitText(
                isKick ? "KICK!" : "PUNCH!",
                (attacker.x + defender.x) / 2
            );

        }


        defender.health = Math.max(
            0,
            defender.health - damage
        );


        if (defender.health <= 0) {

            updateHud();

            endRound(number);

        }

    }


    updateHud();


    setTimeout(() => {

        attacker.attacking = false;

    }, isKick ? 450 : 310);

}


/* ============================================
   15. SPECIAL ATTACK
   ============================================ */

function specialAttack(number) {

    if (!gameRunning) return;


    const attacker = player[number];

    const defender = player[number === 1 ? 2 : 1];


    if (attacker.attacking) return;


    if (attacker.power < CONFIG.specialCost) {

        hitText("NEED 50 POWER", attacker.x);

        return;

    }


    attacker.power -= CONFIG.specialCost;

    attacker.attacking = true;


    showAttackAnimation(
        attacker,
        "special",
        620
    );


    playSound("special");


    if (isInRange(attacker, defender, 190)) {

        const damage = defender.blocking

            ? Math.max(
                1,
                Math.round(CONFIG.specialDamage * 0.3)
            )

            : CONFIG.specialDamage;


        defender.health = Math.max(
            0,
            defender.health - damage
        );


        hitText(
            defender.blocking
                ? "SPECIAL BLOCK!"
                : "SPECIAL HIT!",
            (attacker.x + defender.x) / 2
        );


        if (defender.health <= 0) {

            updateHud();

            endRound(number);

        }

    }


    updateHud();


    setTimeout(() => {

        attacker.attacking = false;

    }, 650);

}


/* ============================================
   16. BLOCKING SYSTEM
   ============================================ */

function setBlock(number, enabled) {

    if (!gameRunning) return;

    player[number].blocking = enabled;

    player[number].element.classList.toggle(
        "blocking",
        enabled
    );

}


/* ============================================
   17. JUMPING SYSTEM
   ============================================ */

function jump(number) {

    const p = player[number];


    if (!gameRunning || p.jumping) return;


    p.jumping = true;

    p.y = CONFIG.jumpHeight;


    setTimeout(() => {

        p.y = 0;

        p.jumping = false;

        render();

    }, 430);

}


/* ============================================
   18. PLAYER ACTION HANDLER
   ============================================ */

function doAction(number, action, down) {

    if (
        action === "left" ||
        action === "right"
    ) {

        const key = `${number}:${action}`;

        if (down) {

            keysDown.add(key);

        } else {

            keysDown.delete(key);

        }

    }


    else if (action === "jump" && down) {

        jump(number);

    }


    else if (action === "crouch") {

        player[number].crouching = down;

    }


    else if (action === "block") {

        setBlock(number, down);

    }


    else if (down && action === "punch") {

        attack(number, "punch");

    }


    else if (down && action === "kick") {

        attack(number, "kick");

    }


    else if (down && action === "special") {

        specialAttack(number);

    }

}


/* ============================================
   19. KEY INPUT PROCESSOR
   ============================================ */

function processKey(key, down, fromRemote = false) {

    const mapped = keyMap[key];

    if (!mapped) return;


    const [number, action] = mapped;


    // Online player can only control their own character

    if (
        mode === "online" &&
        !fromRemote &&
        number !== localOnlinePlayer
    ) {

        return;

    }


    doAction(number, action, down);


    // Send local inputs to opponent

    if (
        mode === "online" &&
        !fromRemote &&
        socket?.connected
    ) {

        socket.emit("game:input", {

            roomCode,

            key,

            down

        });

    }

}


/* ============================================
   20. KEYBOARD EVENT LISTENERS
   ============================================ */

document.addEventListener("keydown", event => {

    const key = event.key.toLowerCase();


    if (key.startsWith("arrow")) {

        event.preventDefault();

    }


    if (event.repeat) return;


    processKey(key, true);

});


document.addEventListener("keyup", event => {

    const key = event.key.toLowerCase();


    if (key.startsWith("arrow")) {

        event.preventDefault();

    }


    processKey(key, false);

});


/* Release held controls when the browser loses focus */

window.addEventListener("blur", () => {

    [...keysDown].forEach(key => {

        const [number, action] = key.split(":");

        doAction(
            Number(number),
            action,
            false
        );

    });


    keysDown.clear();


    [1, 2].forEach(number => {

        player[number].blocking = false;

        player[number].crouching = false;

    });

});


/* ============================================
   21. GAME LOOP AND MOVEMENT
   ============================================ */

function gameLoop() {

    cancelAnimationFrame(rafId);


    const tick = () => {

        if (!gameRunning) return;


        if (keysDown.has("1:left")) {

            player[1].x -= CONFIG.moveSpeed;

        }


        if (keysDown.has("1:right")) {

            player[1].x += CONFIG.moveSpeed;

        }


        if (keysDown.has("2:left")) {

            player[2].x -= CONFIG.moveSpeed;

        }


        if (keysDown.has("2:right")) {

            player[2].x += CONFIG.moveSpeed;

        }


        render();


        rafId = requestAnimationFrame(tick);

    };


    rafId = requestAnimationFrame(tick);

}


/* ============================================
   22. START A ROUND
   ============================================ */

function startRound() {

    clearInterval(timerId);

    cancelAnimationFrame(rafId);


    gameRunning = false;

    ui.overlay.hidden = true;

    keysDown.clear();


    roundTime = CONFIG.roundSeconds;


    [1, 2].forEach(number => {

        const p = player[number];


        p.health = CONFIG.maxHealth;

        p.power = 0;

        p.comboHits = 0;

        p.lastComboHit = 0;


        p.x = number === 1

            ? 65

            : Math.max(
                180,
                ui.stage.clientWidth - 185
            );


        p.y = 0;

        p.jumping = false;

        p.crouching = false;

        p.blocking = false;

        p.attacking = false;


        p.element.classList.remove(
            "punch",
            "kick",
            "special",
            "hit",
            "blocking",
            "jumping",
            "crouching"
        );

    });


    updateHud();

    render();


    gameRunning = true;


    ui.banner.textContent = "FIGHT!";


    setTimeout(() => {

        if (gameRunning) {

            ui.banner.textContent = "";

        }

    }, 800);


    const startedAt = Date.now();


    timerId = setInterval(() => {

        if (!gameRunning) return;


        roundTime = Math.max(

            0,

            CONFIG.roundSeconds -
            Math.floor(
                (Date.now() - startedAt) / 1000
            )

        );


        ui.timer.textContent = roundTime;


        if (roundTime <= 0) {

            const winner =

                player[1].health === player[2].health

                    ? 0

                    : (
                        player[1].health > player[2].health
                            ? 1
                            : 2
                    );


            endRound(winner);

        }

    }, 200);


    gameLoop();

}


/* ============================================
   23. BEGIN CHAMPIONSHIP
   ============================================ */

function beginMatch() {

    roundNumber = 1;

    matchOver = false;


    player[1].score = 0;

    player[2].score = 0;


    matchStartedAt = Date.now();


    $("matchModeLabel").textContent =
        mode === "online"
            ? "ONLINE MATCH"
            : "LOCAL MATCH";


    $("status").textContent =
        "First to win two rounds becomes champion.";


    showScreen("gameScreen");


    startRound();

}


/* ============================================
   24. SAVE MATCH RESULTS
   ============================================ */

function saveMatchResult() {

    const winner =

        player[1].score === player[2].score

            ? 0

            : (
                player[1].score > player[2].score
                    ? 1
                    : 2
            );


    const records = loadRecords();


    const record = {

        date: new Date().toLocaleString(),

        winner: winner
            ? selected[winner].name
            : "DRAW",

        p1: selected[1].name,

        p2: selected[2].name,

        score: `${player[1].score}-${player[2].score}`,

        mode

    };


    records.history.unshift(record);

    records.history = records.history.slice(0, 30);


    if (winner) {

        records.wins[record.winner] =
            (records.wins[record.winner] || 0) + 1;

    }


    localStorage.setItem(
        "friendFighterRecords",
        JSON.stringify(records)
    );

}


/* ============================================
   25. LOAD SAVED RECORDS
   ============================================ */

function loadRecords() {

    try {

        return JSON.parse(
            localStorage.getItem("friendFighterRecords")
        ) || {
            wins: {},
            history: []
        };

    } catch {

        return {
            wins: {},
            history: []
        };

    }

}


/* ============================================
   26. LEADERBOARD AND HISTORY
   ============================================ */

function renderRecords() {

    const records = loadRecords();


    const leaderboard = Object.entries(
        records.wins
    ).sort(
        (a, b) => b[1] - a[1]
    );


    $("leaderboardList").innerHTML = leaderboard.length
        ? ""
        : "<li>No wins recorded yet.</li>";


    leaderboard.forEach(([name, wins]) => {

        const li = document.createElement("li");

        li.textContent = `${name} — ${wins} wins`;

        $("leaderboardList").appendChild(li);

    });


    $("historyList").innerHTML = "";


    if (!records.history.length) {

        $("historyList").innerHTML =
            "<li>No matches played yet.</li>";

        return;

    }


    records.history.slice(0, 12).forEach(match => {

        const li = document.createElement("li");


        li.textContent =

            `${match.date}: ${match.p1} vs ${match.p2} ` +
            `(${match.score}) — ${match.winner}`;


        $("historyList").appendChild(li);

    });

}


/* ============================================
   27. RETURN TO MAIN MENU
   ============================================ */

function goMenu() {

    clearInterval(timerId);

    cancelAnimationFrame(rafId);


    gameRunning = false;

    ui.overlay.hidden = true;


    if (mode === "online" && socket?.connected) {

        socket.emit("room:leave", {
            roomCode
        });

        socket.disconnect();

    }


    socket = null;

    roomCode = "";

    localOnlinePlayer = 0;

    mode = "local";


    showScreen("menuScreen");

}


/* ============================================
   28. START LOCAL MATCH
   ============================================ */

function startLocal() {

    mode = "local";

    localOnlinePlayer = 0;


    setCharacter(1, selected[1]);

    setCharacter(2, selected[2]);


    beginMatch();

}


/* ============================================
   29. MAIN MENU BUTTONS
   ============================================ */

$("quickFightBtn").addEventListener("click", () => {

    randomSelection();

    startLocal();

});


$("chooseFightersBtn").addEventListener("click", () => {

    mode = "local";

    renderSelection();

    showScreen("selectScreen");

});


$("selectBackBtn").addEventListener("click", () => {

    showScreen("menuScreen");

});


$("localStartBtn").addEventListener("click", startLocal);


$("onlineBtn").addEventListener("click", () => {

    showScreen("onlineScreen");

    connectSocket();

});


$("recordsBtn").addEventListener("click", () => {

    renderRecords();

    showScreen("recordsScreen");

});


$("recordsBackBtn").addEventListener("click", () => {

    showScreen("menuScreen");

});


$("onlineBackBtn").addEventListener("click", () => {

    if (socket?.connected) {

        socket.disconnect();

    }

    socket = null;

    showScreen("menuScreen");

});


$("quitMatchBtn").addEventListener("click", goMenu);


/* ============================================
   30. MOBILE TOUCH CONTROLS
   ============================================ */

document.querySelectorAll(
    ".touch-grid button"
).forEach(button => {

    const key = button.dataset.key;


    const down = event => {

        event.preventDefault();

        button.classList.add("pressed");

        processKey(key, true);

    };


    const up = event => {

        event.preventDefault();

        button.classList.remove("pressed");

        processKey(key, false);

    };


    button.addEventListener("pointerdown", down);


    [
        "pointerup",
        "pointercancel",
        "lostpointercapture",
        "pointerleave"
    ].forEach(eventName => {

        button.addEventListener(eventName, up);

    });

});


/* ============================================
   31. ONLINE MULTIPLAYER STATUS
   ============================================ */

function setRoomStatus(message, isError = false) {

    $("roomStatus").textContent = message;

    $("roomStatus").style.color =
        isError ? "#ff7777" : "";

}


/* ============================================
   32. SOCKET.IO CONNECTION
   ============================================ */

function connectSocket() {

    if (socket?.connected) return;


    if (typeof io !== "function") {

        setRoomStatus(
            "Socket.IO client did not load. Start the Node server and reload.",
            true
        );

        return;

    }


    socket = io();


    setRoomStatus("Connecting to game server…");


    socket.on("connect", () => {

        setRoomStatus(
            "Connected. Create a room or join with a code."
        );

    });


    socket.on("connect_error", () => {

        setRoomStatus(
            "Cannot reach server. Start it with npm start, then open http://localhost:3000.",
            true
        );

    });


    /* ROOM CREATED */

    socket.on("room:created", data => {

        roomCode = data.roomCode;

        isHost = true;

        localOnlinePlayer = 1;


        $("roomWaiting").hidden = false;

        $("roomCodeDisplay").textContent = roomCode;


        $("roomPlayerStatus").textContent =
            "Room created. Waiting for Player 2…";


        $("onlineStartBtn").disabled = true;


        setRoomStatus(
            "Share this room code with your friend."
        );

    });


    /* ROOM JOINED */

    socket.on("room:joined", data => {

        roomCode = data.roomCode;

        localOnlinePlayer = 2;

        isHost = false;


        $("roomWaiting").hidden = false;

        $("roomCodeDisplay").textContent = roomCode;


        $("roomPlayerStatus").textContent =
            "Joined room. Waiting for host to start…";


        $("onlineStartBtn").disabled = true;


        setRoomStatus("You joined the room.");

    });


    /* BOTH PLAYERS CONNECTED */

    socket.on("room:ready", () => {

        $("roomPlayerStatus").textContent =
            "Both players connected. Host can start the match.";


        $("onlineStartBtn").disabled = !isHost;

    });


    /* ROOM ERROR */

    socket.on("room:error", data => {

        setRoomStatus(
            data.message || "Room error.",
            true
        );

    });


    /* MATCH START */

    socket.on("match:start", data => {

        selected[1] =
            friends.find(
                f => f.name === data.characters[1].name
            ) || friends[0];


        selected[2] =
            friends.find(
                f => f.name === data.characters[2].name
            ) || friends[1];


        setCharacter(1, selected[1]);

        setCharacter(2, selected[2]);


        mode = "online";


        beginMatch();


        $("status").textContent =
            `Online room ${roomCode} — you are Player ${localOnlinePlayer}.`;

    });


    /* RECEIVE OPPONENT INPUT */

    socket.on("game:input", data => {

        processKey(
            data.key,
            data.down,
            true
        );

    });


    /* SYNCHRONIZE ROUND SCORE */

    socket.on("match:sync-round", data => {

        if (!gameRunning) return;


        player[1].score = data.score1;

        player[2].score = data.score2;


        updateHud();

    });


    /* OPPONENT DISCONNECTED */

    socket.on("match:opponent-left", () => {

        gameRunning = false;

        clearInterval(timerId);


        setRoomStatus(
            "Your opponent disconnected."
        );


        $("status").textContent =
            "Opponent disconnected. Return to menu.";

    });

}


/* ============================================
   33. CREATE ONLINE ROOM
   ============================================ */

$("createRoomBtn").addEventListener("click", () => {

    connectSocket();


    const name =
        safeText($("playerNameInput").value) || "Player 1";


    const wait = () => {

        if (socket?.connected) {

            socket.emit("room:create", {
                name
            });

        } else {

            setTimeout(wait, 250);

        }

    };


    wait();

});


/* ============================================
   34. JOIN ONLINE ROOM
   ============================================ */

$("joinRoomBtn").addEventListener("click", () => {

    connectSocket();


    const code = safeText(
        $("roomCodeInput").value,
        6
    ).toUpperCase();


    const name =
        safeText($("playerNameInput").value) || "Player 2";


    if (code.length !== 6) {

        setRoomStatus(
            "Enter the 6-character room code.",
            true
        );

        return;

    }


    const join = () => {

        if (socket?.connected) {

            socket.emit("room:join", {

                roomCode: code,

                name

            });

        } else {

            setTimeout(join, 250);

        }

    };


    join();

});


/* ============================================
   35. HOST STARTS ONLINE MATCH
   ============================================ */

$("onlineStartBtn").addEventListener("click", () => {

    if (!isHost || !socket?.connected) return;


    const shuffled = [...friends].sort(
        () => Math.random() - 0.5
    );


    socket.emit("match:start", {

        roomCode,

        characters: {

            1: shuffled[0],

            2: shuffled[1]

        }

    });

});


/* ============================================
   36. WINDOW RESIZE
   ============================================ */

window.addEventListener("resize", render);


/* ============================================
   37. INITIALIZE GAME
   ============================================ */

showScreen("menuScreen");

console.log(
    "Friend Fighter initialized successfully!"
);