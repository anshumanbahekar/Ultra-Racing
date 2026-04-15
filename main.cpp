#include <iostream>
#include <conio.h>
#include <windows.h>
#include <vector>
#include <ctime>

using namespace std;

const int WIDTH = 30;
const int HEIGHT = 20;

int playerX = WIDTH / 2;
int score = 0;
bool gameOver = false;

struct Enemy {
    int x, y;
};

vector<Enemy> enemies;

void gotoxy(int x, int y) {
    COORD coord;
    coord.X = x;
    coord.Y = y;
    SetConsoleCursorPosition(GetStdHandle(STD_OUTPUT_HANDLE), coord);
}

void hideCursor() {
    HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
    CONSOLE_CURSOR_INFO cursorInfo;
    cursorInfo.dwSize = 1;
    cursorInfo.bVisible = FALSE;
    SetConsoleCursorInfo(hOut, &cursorInfo);
}

void drawBorders() {
    for (int i = 0; i < WIDTH; i++) {
        gotoxy(i, 0); cout << "#";
        gotoxy(i, HEIGHT); cout << "#";
    }
    for (int i = 0; i <= HEIGHT; i++) {
        gotoxy(0, i); cout << "#";
        gotoxy(WIDTH - 1, i); cout << "#";
    }
}

void drawPlayer() {
    gotoxy(playerX, HEIGHT - 2);
    cout << "A";
}

void drawEnemies() {
    for (auto &e : enemies) {
        gotoxy(e.x, e.y);
        cout << "V";
    }
}

void eraseEnemies() {
    for (auto &e : enemies) {
        gotoxy(e.x, e.y);
        cout << " ";
    }
}

void spawnEnemy() {
    if (rand() % 10 < 2) {
        Enemy e;
        e.x = 1 + rand() % (WIDTH - 2);
        e.y = 1;
        enemies.push_back(e);
    }
}

void moveEnemies() {
    for (auto &e : enemies) {
        e.y++;
    }

    enemies.erase(remove_if(enemies.begin(), enemies.end(),
        [](Enemy e) { return e.y > HEIGHT; }),
        enemies.end());
}

void checkCollision() {
    for (auto &e : enemies) {
        if (e.y == HEIGHT - 2 && e.x == playerX) {
            gameOver = true;
        }
    }
}

void input() {
    if (_kbhit()) {
        char ch = _getch();
        if (ch == 'a' || ch == 'A') {
            if (playerX > 1) playerX--;
        }
        if (ch == 'd' || ch == 'D') {
            if (playerX < WIDTH - 2) playerX++;
        }
        if (ch == 'q' || ch == 'Q') {
            gameOver = true;
        }
    }
}

void drawScore() {
    gotoxy(WIDTH + 2, 2);
    cout << "Score: " << score;
}

int main() {
    srand(time(0));
    hideCursor();

    while (!gameOver) {
        drawBorders();

        input();

        eraseEnemies();
        spawnEnemy();
        moveEnemies();
        drawEnemies();

        drawPlayer();
        checkCollision();

        drawScore();

        score++;

        Sleep(100);
    }

    system("cls");
    cout << "💥 GAME OVER!\n";
    cout << "Final Score: " << score << endl;

    return 0;
}
