// ------------------------------------------------------------------------
// How To Make A Match-3 Game With HTML5 Canvas
// Copyright (c) 2015 Rembound.com
// 
// This program is free software: you can redistribute it and/or modify  
// it under the terms of the GNU General Public License as published by  
// the Free Software Foundation, either version 3 of the License, or  
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,  
// but WITHOUT ANY WARRANTY; without even the implied warranty of  
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the  
// GNU General Public License for more details.  
// 
// You should have received a copy of the GNU General Public License  
// along with this program.  If not, see http://www.gnu.org/licenses/.
//
// http://rembound.com/articles/how-to-make-a-match3-game-with-html5-canvas
// ------------------------------------------------------------------------

// The function gets called when the window is fully loaded
window.onload = function () {
    // Get the canvas and context
    var canvas = document.getElementById("viewport");
    var context = canvas.getContext("2d");

    // Timing and frames per second
    var lastFrameTime = 0;
    var frameTime = 0;
    var frameCount = 0;
    var fps = 0;

    // Mouse dragging
    var drag = false;

    // Level object
    var level = {
        x: 250,         // X position
        y: 113,         // Y position
        columns: 8,     // Number of tile columns
        rows: 8,        // Number of tile rows
        tileWidth: 40,  // Visual width of a tile
        tileHeight: 40, // Visual height of a tile
        tiles: [],      // The two-dimensional tile array
        selectedTile: {selected: false, column: 0, row: 0}
    };

    // All of the different tile colors in RGB
    var tileColors = [[255, 128, 128],
        [128, 255, 128],
        [128, 128, 255],
        [255, 255, 128],
        [255, 128, 255],
        [128, 255, 255],
        [255, 255, 255]];

    // Clusters and moves that were found
    var clusters = [];  // { column, row, length, horizontal }
    var moves = [];     // { column1, row1, column2, row2 }

    // Current move
    var currentMove = {column1: 0, row1: 0, column2: 0, row2: 0};

    // Game states
    var gameStates = {init: 0, ready: 1, resolve: 2};
    var gameState = gameStates.init;

    // Score
    var score = 0;

    // Animation variables
    var animationState = 0;
    var animationTime = 0;
    var animationTimeTotal = 0.3;

    // Show available moves
    var canShowMoves = false;

    // The AI bot
    var isAIBotEnabled = false;

    // Game Over
    var isGameOver = false;

    // Gui buttons
    var buttons = [{x: 30, y: 240, width: 150, height: 50, text: "New Game"},
        {x: 30, y: 300, width: 150, height: 50, text: "Show Moves"},
        {x: 30, y: 360, width: 150, height: 50, text: "Enable AI Bot"}];

    // Initialize the game
    function init() {
        // Add mouse events
        canvas.addEventListener("mousemove", onMouseMove);
        canvas.addEventListener("mousedown", onMouseDown);
        canvas.addEventListener("mouseup", onMouseUp);
        canvas.addEventListener("mouseout", onMouseOut);

        // Initialize the two-dimensional tile array
        for (var i = 0; i < level.columns; i += 1) {
            level.tiles[i] = [];
            for (var j = 0; j < level.rows; j += 1) {
                // Define a tile type and a shift parameter for animation
                level.tiles[i][j] = {type: 0, shift: 0}
            }
        }

        // New game
        newGame();

        // Enter main loop
        main(0);
    }

    // Main loop
    function main(currentFrameTime) {
        // Request animation frames
        window.requestAnimationFrame(main);

        // Update and render the game
        update(currentFrameTime);
        render();
    }

    // Update the game state
    function update(currentFrameTime) {
        var deltaFrameTime = (currentFrameTime - lastFrameTime) / 1000;
        lastFrameTime = currentFrameTime;

        // Update the fps counter
        updateFps(deltaFrameTime);

        if (gameState == gameStates.ready) {
            // Game is ready for player input

            // Check for game over
            if (moves.length <= 0) {
                isGameOver = true;
            }

            // Let the AI bot make a move, if enabled
            if (isAIBotEnabled) {
                animationTime += deltaFrameTime;
                if (animationTime > animationTimeTotal) {
                    // Check if there are moves available
                    findMoves();

                    if (moves.length > 0) {
                        // Get a random valid move
                        var move = moves[Math.floor(Math.random() * moves.length)];

                        // Simulate a player using the mouse to swap two tiles
                        mouseSwap(move.column1, move.row1, move.column2, move.row2);
                    } else {
                        // No moves left, Game Over. We could start a new game.
                        // newGame();
                    }
                    animationTime = 0;
                }
            }
        } else if (gameState == gameStates.resolve) {
            // Game is busy resolving and animating clusters
            animationTime += deltaFrameTime;

            if (animationState == 0) {
                // Clusters need to be found and removed
                if (animationTime > animationTimeTotal) {
                    // Find clusters
                    findClusters();

                    if (clusters.length > 0) {
                        // Add points to the score
                        for (var i = 0; i < clusters.length; i += 1) {
                            // Add extra points for longer clusters
                            score += 100 * (clusters[i].length - 2);
                        }

                        // Clusters found, remove them
                        removeClusters();

                        // Tiles need to be shifted
                        animationState = 1;
                    } else {
                        // No clusters found, animation complete
                        gameState = gameStates.ready;
                    }
                    animationTime = 0;
                }
            } else if (animationState == 1) {
                // Tiles need to be shifted
                if (animationTime > animationTimeTotal) {
                    // Shift tiles
                    shiftTiles();

                    // New clusters need to be found
                    animationState = 0;
                    animationTime = 0;

                    // Check if there are new clusters
                    findClusters();
                    if (clusters.length <= 0) {
                        // Animation complete
                        gameState = gameStates.ready;
                    }
                }
            } else if (animationState == 2) {
                // Swapping tiles animation
                if (animationTime > animationTimeTotal) {
                    // Swap the tiles
                    swap(currentMove.column1, currentMove.row1, currentMove.column2, currentMove.row2);

                    // Check if the swap made a cluster
                    findClusters();
                    if (clusters.length > 0) {
                        // Valid swap, found one or more clusters
                        // Prepare animation states
                        animationState = 0;
                        animationTime = 0;
                        gameState = gameStates.resolve;
                    } else {
                        // Invalid swap, Rewind swapping animation
                        animationState = 3;
                        animationTime = 0;
                    }

                    // Update moves and clusters
                    findMoves();
                    findClusters();
                }
            } else if (animationState == 3) {
                // Rewind swapping animation
                if (animationTime > animationTimeTotal) {
                    // Invalid swap, swap back
                    swap(currentMove.column1, currentMove.row1, currentMove.column2, currentMove.row2);

                    // Animation complete
                    gameState = gameStates.ready;
                }
            }

            // Update moves and clusters
            findMoves();
            findClusters();
        }
    }

    function updateFps(dt) {
        if (frameTime > 0.25) {
            // Calculate fps
            fps = Math.round(frameCount / frameTime);

            // Reset time and frameCount
            frameTime = 0;
            frameCount = 0;
        }

        // Increase time and frameCount
        frameTime += dt;
        frameCount += 1;
    }

    // Draw text that is centered
    function drawCenterText(text, x, y, width) {
        var textMetrics = context.measureText(text);
        context.fillText(text, x + (width - textMetrics.width) / 2, y);
    }

    // Render the game
    function render() {
        // Draw the frame
        drawFrame();

        // Draw score
        context.fillStyle = "#000000";
        context.font = "24px Verdana";
        drawCenterText("Score:", 30, level.y + 40, 150);
        drawCenterText(score, 30, level.y + 70, 150);

        // Draw buttons
        drawButtons();

        // Draw level background
        var levelWidth = level.columns * level.tileWidth;
        var levelHeight = level.rows * level.tileHeight;
        context.fillStyle = "#000000";
        context.fillRect(level.x - 4, level.y - 4, levelWidth + 8, levelHeight + 8);

        // Render tiles
        renderTiles();

        // Render clusters
        renderClusters();

        // Render moves, when there are no clusters
        if (canShowMoves && clusters.length <= 0 && gameState == gameStates.ready) {
            renderMoves();
        }

        // Game Over overlay
        if (isGameOver) {
            context.fillStyle = "rgba(0, 0, 0, 0.8)";
            context.fillRect(level.x, level.y, levelWidth, levelHeight);

            context.fillStyle = "#ffffff";
            context.font = "24px Verdana";
            drawCenterText("Game Over!", level.x, level.y + levelHeight / 2 + 10, levelWidth);
        }
    }

    // Draw a frame with a border
    function drawFrame() {
        // Draw background and a border
        context.fillStyle = "#d0d0d0";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "rgb(232, 234, 236)";
        context.fillRect(1, 1, canvas.width - 2, canvas.height - 2);

        // Draw header
        context.fillStyle = "#303030";
        context.fillRect(0, 0, canvas.width, 65);

        // Draw title
        context.fillStyle = "#ffffff";
        context.font = "24px Verdana";
        context.fillText("Match3 Example - Rembound.com", 10, 30);

        // Display fps
        context.fillStyle = "#ffffff";
        context.font = "12px Verdana";
        context.fillText("Fps: " + fps, 13, 50);
    }

    // Draw buttons
    function drawButtons() {
        for (var i = 0; i < buttons.length; i += 1) {
            // Draw button shape
            context.fillStyle = "#000000";
            context.fillRect(buttons[i].x, buttons[i].y, buttons[i].width, buttons[i].height);

            // Draw button text
            context.fillStyle = "#ffffff";
            context.font = "18px Verdana";
            var textMetrics = context.measureText(buttons[i].text);
            context.fillText(buttons[i].text, buttons[i].x + (buttons[i].width - textMetrics.width) / 2, buttons[i].y + 30);
        }
    }

    // Render tiles
    function renderTiles() {
        for (var i = 0; i < level.columns; i += 1) {
            for (var j = 0; j < level.rows; j += 1) {
                // Get the shift of the tile for animation
                var shift = level.tiles[i][j].shift;

                // Calculate the tile coordinates
                var coordinate = getTileCoordinate(i, j, 0, (animationTime / animationTimeTotal) * shift);

                // Check if there is a tile present
                if (level.tiles[i][j].type >= 0) {
                    // Get the color of the tile
                    var col = tileColors[level.tiles[i][j].type];

                    // Draw the tile using the color
                    drawTile(coordinate.tileX, coordinate.tileY, col[0], col[1], col[2]);
                }

                // Draw the selected tile
                if (level.selectedTile.selected) {
                    if (level.selectedTile.column == i && level.selectedTile.row == j) {
                        // Draw a red tile
                        drawTile(coordinate.tileX, coordinate.tileY, 255, 0, 0);
                    }
                }
            }
        }

        // Render the swap animation
        if (gameState == gameStates.resolve && (animationState == 2 || animationState == 3)) {
            // Calculate the x and y shift
            var shiftX = currentMove.column2 - currentMove.column1;
            var shiftY = currentMove.row2 - currentMove.row1;

            // First tile
            var firstTileStartCoordinate = getTileCoordinate(currentMove.column1, currentMove.row1, 0, 0);
            var firstTileEndCoordinate = getTileCoordinate(currentMove.column1, currentMove.row1, (animationTime / animationTimeTotal) * shiftX, (animationTime / animationTimeTotal) * shiftY);
            var firstTileColor = tileColors[level.tiles[currentMove.column1][currentMove.row1].type];

            // Second tile
            var secondTileStartCoordinate = getTileCoordinate(currentMove.column2, currentMove.row2, 0, 0);
            var secondTileEndCoordinate = getTileCoordinate(currentMove.column2, currentMove.row2, (animationTime / animationTimeTotal) * -shiftX, (animationTime / animationTimeTotal) * -shiftY);
            var secondTileColor = tileColors[level.tiles[currentMove.column2][currentMove.row2].type];

            // Draw a black background
            drawTile(firstTileStartCoordinate.tileX, firstTileStartCoordinate.tileY, 0, 0, 0);
            drawTile(secondTileStartCoordinate.tileX, secondTileStartCoordinate.tileY, 0, 0, 0);

            // Change the order, depending on the animation state
            if (animationState == 2) {
                // Draw the tiles
                drawTile(firstTileEndCoordinate.tileX, firstTileEndCoordinate.tileY, firstTileColor[0], firstTileColor[1], firstTileColor[2]);
                drawTile(secondTileEndCoordinate.tileX, secondTileEndCoordinate.tileY, secondTileColor[0], secondTileColor[1], secondTileColor[2]);
            } else {
                // Draw the tiles
                drawTile(secondTileEndCoordinate.tileX, secondTileEndCoordinate.tileY, secondTileColor[0], secondTileColor[1], secondTileColor[2]);
                drawTile(firstTileEndCoordinate.tileX, firstTileEndCoordinate.tileY, firstTileColor[0], firstTileColor[1], firstTileColor[2]);
            }
        }
    }

    // Get the tile coordinate
    function getTileCoordinate(column, row, columnOffset, rowOffset) {
        var tileX = level.x + (column + columnOffset) * level.tileWidth;
        var tileY = level.y + (row + rowOffset) * level.tileHeight;
        return {tileX: tileX, tileY: tileY};
    }

    // Draw a tile with a color
    function drawTile(x, y, r, g, b) {
        context.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
        context.fillRect(x + 2, y + 2, level.tileWidth - 4, level.tileHeight - 4);
    }

    // Render clusters
    function renderClusters() {
        for (var i = 0; i < clusters.length; i += 1) {
            // Calculate the tile coordinates
            var coordinate = getTileCoordinate(clusters[i].column, clusters[i].row, 0, 0);

            if (clusters[i].horizontal) {
                // Draw a horizontal line
                context.fillStyle = "#00ff00";
                context.fillRect(coordinate.tileX + level.tileWidth / 2, coordinate.tileY + level.tileHeight / 2 - 4, (clusters[i].length - 1) * level.tileWidth, 8);
            } else {
                // Draw a vertical line
                context.fillStyle = "#0000ff";
                context.fillRect(coordinate.tileX + level.tileWidth / 2 - 4, coordinate.tileY + level.tileHeight / 2, 8, (clusters[i].length - 1) * level.tileHeight);
            }
        }
    }

    // Render moves
    function renderMoves() {
        for (var i = 0; i < moves.length; i += 1) {
            // Calculate coordinates of tile 1 and 2
            var firstTileCoordinate = getTileCoordinate(moves[i].column1, moves[i].row1, 0, 0);
            var secondTileCoordinate = getTileCoordinate(moves[i].column2, moves[i].row2, 0, 0);

            // Draw a line from tile 1 to tile 2
            context.strokeStyle = "#ff0000";
            context.beginPath();
            context.moveTo(firstTileCoordinate.tileX + level.tileWidth / 2, firstTileCoordinate.tileY + level.tileHeight / 2);
            context.lineTo(secondTileCoordinate.tileX + level.tileWidth / 2, secondTileCoordinate.tileY + level.tileHeight / 2);
            context.stroke();
        }
    }

    // Start a new game
    function newGame() {
        // Reset score
        score = 0;

        // Set the gameState to ready
        gameState = gameStates.ready;

        // Reset game over
        isGameOver = false;

        // Create the level
        createLevel();

        // Find initial clusters and moves
        findMoves();
        findClusters();
    }

    // Create a random level
    function createLevel() {
        var done = false;

        // Keep generating levels until it is correct
        while (!done) {

            // Create a level with random tiles
            for (var i = 0; i < level.columns; i += 1) {
                for (var j = 0; j < level.rows; j += 1) {
                    level.tiles[i][j].type = getRandomTile();
                }
            }

            // Resolve the clusters
            resolveClusters();

            // Check if there are valid moves
            findMoves();

            // Done when there is a valid move
            if (moves.length > 0) {
                done = true;
            }
        }
    }

    // Get a random tile
    function getRandomTile() {
        return Math.floor(Math.random() * tileColors.length);
    }

    // Remove clusters and insert tiles
    function resolveClusters() {
        // Check for clusters
        findClusters();

        // While there are clusters left
        while (clusters.length > 0) {

            // Remove clusters
            removeClusters();

            // Shift tiles
            shiftTiles();

            // Check if there are clusters left
            findClusters();
        }
    }

    // Find clusters in the level
    function findClusters() {
        var i, j, matchLength, isClusterFound;
        // Reset clusters
        clusters = [];

        // Find horizontal clusters
        for (j = 0; j < level.rows; j += 1) {
            // Start with a single tile, cluster of 1
            matchLength = 1;
            for (i = 0; i < level.columns; i += 1) {
                isClusterFound = false;

                if (i == level.columns - 1) {
                    // Last tile
                    isClusterFound = true;
                } else {
                    // Check the type of the next tile
                    if (level.tiles[i][j].type == level.tiles[i + 1][j].type &&
                        level.tiles[i][j].type != -1) {
                        // Same type as the previous tile, increase matchLength
                        matchLength += 1;
                    } else {
                        // Different type
                        isClusterFound = true;
                    }
                }

                // Check if there was a cluster
                if (isClusterFound) {
                    if (matchLength >= 3) {
                        // Found a horizontal cluster
                        clusters.push({
                            column: i + 1 - matchLength, row: j,
                            length: matchLength, horizontal: true
                        });
                    }

                    matchLength = 1;
                }
            }
        }

        // Find vertical clusters
        for (i = 0; i < level.columns; i += 1) {
            // Start with a single tile, cluster of 1
            matchLength = 1;
            for (j = 0; j < level.rows; j += 1) {
                isClusterFound = false;

                if (j == level.rows - 1) {
                    // Last tile
                    isClusterFound = true;
                } else {
                    // Check the type of the next tile
                    if (level.tiles[i][j].type == level.tiles[i][j + 1].type &&
                        level.tiles[i][j].type != -1) {
                        // Same type as the previous tile, increase matchLength
                        matchLength += 1;
                    } else {
                        // Different type
                        isClusterFound = true;
                    }
                }

                // Check if there was a cluster
                if (isClusterFound) {
                    if (matchLength >= 3) {
                        // Found a vertical cluster
                        clusters.push({
                            column: i, row: j + 1 - matchLength,
                            length: matchLength, horizontal: false
                        });
                    }

                    matchLength = 1;
                }
            }
        }
    }

    // Find available moves
    function findMoves() {
        var i, j;

        // Reset moves
        moves = [];

        // Check horizontal swaps
        for (j = 0; j < level.rows; j += 1) {
            for (i = 0; i < level.columns - 1; i += 1) {
                // Swap, find clusters and swap back
                swap(i, j, i + 1, j);
                findClusters();
                swap(i, j, i + 1, j);

                // Check if the swap made a cluster
                if (clusters.length > 0) {
                    // Found a move
                    moves.push({column1: i, row1: j, column2: i + 1, row2: j});
                }
            }
        }

        // Check vertical swaps
        for (i = 0; i < level.columns; i += 1) {
            for (j = 0; j < level.rows - 1; j += 1) {
                // Swap, find clusters and swap back
                swap(i, j, i, j + 1);
                findClusters();
                swap(i, j, i, j + 1);

                // Check if the swap made a cluster
                if (clusters.length > 0) {
                    // Found a move
                    moves.push({column1: i, row1: j, column2: i, row2: j + 1});
                }
            }
        }

        // Reset clusters
        clusters = []
    }

    // Loop over the cluster tiles and execute a function
    function loopClusters(clusterFunction) {
        for (var i = 0; i < clusters.length; i += 1) {
            //  { column, row, length, horizontal }
            var cluster = clusters[i];
            var columnOffset = 0;
            var rowOffset = 0;
            for (var j = 0; j < cluster.length; j += 1) {
                clusterFunction(cluster.column + columnOffset, cluster.row + rowOffset);

                if (cluster.horizontal) {
                    columnOffset += 1;
                } else {
                    rowOffset += 1;
                }
            }
        }
    }

    // Remove the clusters
    function removeClusters() {
        // Change the type of the tiles to -1, indicating a removed tile
        loopClusters(function (column, row) {
            level.tiles[column][row].type = -1;
        });

        // Calculate how much a tile should be shifted downwards
        for (var i = 0; i < level.columns; i += 1) {
            var shift = 0;
            for (var j = level.rows - 1; j >= 0; j -= 1) {
                // Loop from bottom to top
                if (level.tiles[i][j].type == -1) {
                    // Tile is removed, increase shift
                    shift += 1;
                    level.tiles[i][j].shift = 0;
                } else {
                    // Set the shift
                    level.tiles[i][j].shift = shift;
                }
            }
        }
    }

    // Shift tiles and insert new tiles
    function shiftTiles() {
        // Shift tiles
        for (var i = 0; i < level.columns; i += 1) {
            for (var j = level.rows - 1; j >= 0; j -= 1) {
                // Loop from bottom to top
                if (level.tiles[i][j].type == -1) {
                    // Insert new random tile
                    level.tiles[i][j].type = getRandomTile();
                } else {
                    // Swap tile to shift it
                    var shift = level.tiles[i][j].shift;
                    if (shift > 0) {
                        swap(i, j, i, j + shift)
                    }
                }

                // Reset shift
                level.tiles[i][j].shift = 0;
            }
        }
    }

    // Get the tile under the mouse
    function getMouseTile(pos) {
        // Calculate the index of the tile
        var tx = Math.floor((pos.x - level.x) / level.tileWidth);
        var ty = Math.floor((pos.y - level.y) / level.tileHeight);

        // Check if the tile is valid
        if (tx >= 0 && tx < level.columns && ty >= 0 && ty < level.rows) {
            // Tile is valid
            return {
                valid: true,
                x: tx,
                y: ty
            };
        }

        // No valid tile
        return {
            valid: false,
            x: 0,
            y: 0
        };
    }

    // Check if two tiles can be swapped
    function canSwap(x1, y1, x2, y2) {
        // Check if the tile is a direct neighbor of the selected tile
        return (
            (Math.abs(x1 - x2) == 1 && y1 == y2) ||
            (Math.abs(y1 - y2) == 1 && x1 == x2)
        );
    }

    // Swap two tiles in the level
    function swap(x1, y1, x2, y2) {
        var firstTileType = level.tiles[x1][y1].type;
        level.tiles[x1][y1].type = level.tiles[x2][y2].type;
        level.tiles[x2][y2].type = firstTileType;
    }

    // Swap two tiles as a player action
    function mouseSwap(c1, r1, c2, r2) {
        // Save the current move
        currentMove = {column1: c1, row1: r1, column2: c2, row2: r2};

        // Deselect
        level.selectedTile.selected = false;

        // Start animation
        animationState = 2;
        animationTime = 0;
        gameState = gameStates.resolve;
    }

    // On mouse movement
    function onMouseMove(e) {
        // Get the mouse position
        var pos = getMousePos(canvas, e);

        // Check if we are dragging with a tile selected
        if (drag && level.selectedTile.selected) {
            // Get the tile under the mouse
            var mouseTilePosition = getMouseTile(pos);
            if (mouseTilePosition.valid) {
                // Valid tile

                // Check if the tiles can be swapped
                if (canSwap(mouseTilePosition.x, mouseTilePosition.y, level.selectedTile.column, level.selectedTile.row)) {
                    // Swap the tiles
                    mouseSwap(mouseTilePosition.x, mouseTilePosition.y, level.selectedTile.column, level.selectedTile.row);
                }
            }
        }
    }

    // On mouse button click
    function onMouseDown(e) {
        // Get the mouse position
        var pos = getMousePos(canvas, e);

        // Start dragging
        if (!drag) {
            // Get the tile under the mouse
            var mouseTilePosition = getMouseTile(pos);

            if (mouseTilePosition.valid) {
                // Valid tile
                var swapped = false;
                if (level.selectedTile.selected) {
                    if (mouseTilePosition.x == level.selectedTile.column && mouseTilePosition.y == level.selectedTile.row) {
                        // Same tile selected, deselect
                        level.selectedTile.selected = false;
                        return;
                    } else if (canSwap(mouseTilePosition.x, mouseTilePosition.y, level.selectedTile.column, level.selectedTile.row)) {
                        // Tiles can be swapped, swap the tiles
                        mouseSwap(mouseTilePosition.x, mouseTilePosition.y, level.selectedTile.column, level.selectedTile.row);
                        swapped = true;
                    }
                }

                if (!swapped) {
                    // Set the new selected tile
                    level.selectedTile.column = mouseTilePosition.x;
                    level.selectedTile.row = mouseTilePosition.y;
                    level.selectedTile.selected = true;
                }
            } else {
                // Invalid tile
                level.selectedTile.selected = false;
            }

            // Start dragging
            drag = true;
        }

        // Check if a button was clicked
        for (var i = 0; i < buttons.length; i += 1) {
            if (pos.x >= buttons[i].x && pos.x < buttons[i].x + buttons[i].width &&
                pos.y >= buttons[i].y && pos.y < buttons[i].y + buttons[i].height) {

                // Button i was clicked
                if (i == 0) {
                    // New Game
                    newGame();
                } else if (i == 1) {
                    // Show Moves
                    canShowMoves = !canShowMoves;
                    buttons[i].text = (canShowMoves ? "Hide" : "Show") + " Moves";
                } else if (i == 2) {
                    // AI Bot
                    isAIBotEnabled = !isAIBotEnabled;
                    buttons[i].text = (isAIBotEnabled ? "Disable" : "Enable") + " AI Bot";
                }
            }
        }
    }

    function onMouseUp() {
        // Reset dragging
        drag = false;
    }

    function onMouseOut() {
        // Reset dragging
        drag = false;
    }

    // Get the mouse position
    function getMousePos(canvas, e) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: Math.round((e.clientX - rect.left) / (rect.right - rect.left) * canvas.width),
            y: Math.round((e.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height)
        };
    }

    // Call init to start the game
    init();
};