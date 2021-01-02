const {enable3d, Scene3D, Canvas, Cameras, THREE, ExtendedObject3D} = ENABLE3D

let game
let asteroids = [[]]

firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
        let game = document.querySelector("#game")
        game.innerHTML = "Please <a href='/login'>Login</a> or <a href='/signup'>Signup</a> to play."
    }
})

function loadingBar(scene) {
    let loadingBG = scene.add.graphics()
    let progressBox = scene.add.graphics()
    let progressBar = scene.add.graphics()
    loadingBG.fillStyle(0x191919, 1)
    progressBox.fillStyle(0x222222, 1)
    loadingBG.fillRect(0, 0, 960, 540)
    progressBox.fillRect(320, 245, 320, 50)

    scene.load.on('progress', value => {
        progressBar.clear()
        progressBar.fillStyle(0x555555, 1)
        progressBar.fillRect(330, 255, 300 * value, 30)
    })

    scene.load.on("complete", () => {
        progressBar.destroy()
        progressBox.destroy()
        loadingBG.destroy()
    })
}

class Pilot extends Scene3D {
    constructor() {
        super({
            key: "Pilot"
        })
    }

    preload() {
        loadingBar(this)

        this.load.image("rock", "/static/assets/space-rock.png")
        this.load.image("arrow", "/static/assets/ship-arrow.png")
        this.load.image("wheel", "/static/assets/steering-wheel.png")
        this.load.image("throttle", "/static/assets/throttle.png")
        this.load.image("throttleHandle", "/static/assets/throttle-handle.png")

        this.third.load.preload("background", "/static/assets/background.png")
    }

    init() {
        this.mapSize = {
            x: 270,
            y: 270
        }

        this.shipX = 0
        this.shipZ = 270

        this.MIN_SPEED = 0.005
        this.MAX_SPEED = 0.025
        this.speed = this.MIN_SPEED
        this.direction = Math.PI / 4
        this.wheelDirection = 0

        this.accessThirdDimension()
    }

    create() {
        this.third.warpSpeed("-ground", "-sky")

        // this.third.physics.debug.enable()

        // set background to black
        this.third.load.texture("background").then(bg => (this.third.scene.background = bg))

        const resize = () => {
            let gameDiv = document.getElementById("game")

            const newWidth = gameDiv.clientHeight * 960 / 540
            const newHeight = gameDiv.clientHeight / 2

            this.third.camera.aspect = newWidth / newHeight
            this.third.camera.updateProjectionMatrix()
            this.third.renderer.setSize(newWidth, newHeight)
        }

        // autoresize 3D renderer
        window.onresize = resize
        resize()

        let graphics = this.add.graphics({
            lineStyle: {
                color: 0xffffff
            },
            fillStyle: {
                color: 0x000000
            }
        })
        // draw game border
        graphics.strokeRect(1, 1, 959, 538)

        // draw map outline
        graphics.strokeRect(345, 270, 270, 270)

        // add throttle
        let throttleX = 960 - (960 - 270) / 4
        let throttleY = 540 * 3 / 4
        this.throttle = this.add.image(throttleX, throttleY, "throttle")
            .setScale(3)
            .setOrigin(0.5, 0.5)
        this.throttleHandle = this.add.image(throttleX, throttleY + 60, "throttleHandle")
            .setScale(3)
            .setOrigin(0.5, 0.5)
            .setInteractive()
            .on("drag", (pointer, dragX, dragY) => {
                this.throttleDrag(pointer, dragX, dragY)
            })
        this.input.setDraggable(this.throttleHandle)

        // add steering wheel
        this.wheel = this.add.image((960 - 270) / 4, 540 * 3 / 4, "wheel")
            .setScale(3)
            .setOrigin(0.5, 0.5)
        this.wheel.rotation = this.wheelDirection

        // add ship arrow to map
        this.arrow = this.add.image(345, 540, "arrow").setScale(0.0625).setOrigin(0.5, 0.5)

        // create ship
        this.ship = this.third.add.sphere({ x: this.shipX, y: 0, z: this.shipZ, radius: 0 })

        let asteroids = this.generateAsteroids(20)
        for (let i = 0; i < 20; i++) {
            this.add.image(355 + asteroids[i][0], 280 + asteroids[i][1], "rock").setScale(0.5, 0.5)
            this.third.add.sphere({ x: 10 + asteroids[i][0], y: Math.random() * 2 - 1, z: 10 + asteroids[i][1], radius: Math.random() + 1 })
        }

        // add keys
        this.keys = {
            a: this.input.keyboard.addKey('a'),
            d: this.input.keyboard.addKey('d')
        }
    }

    update(time, delta) {
        if (this.keys.a.isDown) {
            // turn wheel left
            this.wheelDirection = Math.max(this.wheelDirection - Math.PI / 180, -Math.PI / 3)
            this.wheel.rotation = this.wheelDirection
        } else if (this.keys.d.isDown) {
            // turn wheel right
            this.wheelDirection = Math.min(this.wheelDirection + Math.PI / 180, Math.PI / 3)
            this.wheel.rotation = this.wheelDirection
        }

        this.direction -= this.wheelDirection * (Math.PI / 90 * this.speed)

        const velX = Math.cos(this.direction) * this.speed
        const velZ = -Math.sin(this.direction) * this.speed

        const x = Math.min(Math.max(this.ship.position.x + velX, 0), this.mapSize.x)
        const z = Math.min(Math.max(this.ship.position.z + velZ, 0), this.mapSize.y)

        this.ship.position.set(x, 0, z)

        this.third.camera.position.set(x, 0, z)
        this.third.camera.lookAt(x + Math.cos(this.direction), 0, z - Math.sin(this.direction))

        this.arrow.x = 345 + x
        this.arrow.y = 270 + z
        this.arrow.rotation = Math.PI / 2 - this.direction
    }

    generateAsteroids(num) {
        let asteroids = []

        for (let i = 0; i < num; i++) {
            let x, y

            spaceOut:
            while (true) {
                // generate x and y more than 10 pixels from the edge
                x = Math.random() * (this.mapSize.x - 20)
                y = Math.random() * (this.mapSize.y - 20)

                // check if asteroids are too close
                for (let j = 0; j < asteroids.length; j++) {
                    if (Math.sqrt((x - asteroids[j][0])**2 + (y - asteroids[j][1])**2) < 10) {
                        // regenerate x and y
                        continue spaceOut
                    }
                }
                break
            }

            asteroids.push([x, y])
        }

        return asteroids
    }

    throttleDrag(pointer, dragX, dragY) {
        let throttleX = 960 - (960 - 270) / 4
        let throttleY = 540 * 3 / 4
        let throttleMin = throttleY + 60
        let throttleMax = throttleY - 60

        this.throttleHandle.x = throttleX
        this.throttleHandle.y = Math.min(Math.max(dragY, throttleMax), throttleMin)

        this.speed = this.MIN_SPEED + (throttleMin - this.throttleHandle.y)
            * (this.MAX_SPEED - this.MIN_SPEED) / (throttleMin - throttleMax)
    }
}

class Start extends Scene3D {
    constructor() {
        super({
            key: "Start"
        })
    }

    preload() {

    }

    init() {
        // this.accessThirdDimension()
    }

    create() {
        // this.third.warpSpeed()

        // this.third.physics.add.box()

        this.add.text(480, 150, "Outmaneuver", {
            fontFamily: "monaco",
            fontSize: "80px",
            fill: "white"
        }).setOrigin(0.5, 0.5)

        let playButton = this.add.text(480, 400, "Play", {
            fontFamily: "monaco",
            fontSize: "24px",
            fill: "white"
        }).setOrigin(0.5, 0.5)

        playButton.setInteractive({useHandCursor: true})
            .on("pointerover", () => playButton.setFill("#0f0"))
            .on("pointerout", () => playButton.setFill("white"))
            .on("pointerdown", () => this.scene.start("Pilot"))
    }
}

let config = {
    type: Phaser.WEBGL,
    transparent: true,
    parent: "game",
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 960,
        height: 540,
    },
    pixelArt: true,
    scene: [Start, Pilot]
}

window.addEventListener('load', () => {
    game = enable3d(() => new Phaser.Game(config)).withPhysics('/static/assets')
})