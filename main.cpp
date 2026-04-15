#include <iostream>
#include <conio.h>
#include <windows.h>
#include <vector>
#include <ctime>
#include <fstream>

using namespace std;

// ===== SETTINGS =====
const int WIDTH = 40;
const int HEIGHT = 25;
const int LANES[3] = {12, 20, 28};

int playerLane = 1;
int score = 0, highScore = 0;
bool gameOver = false;

bool nitro = false;
int nitroTimer = 0, nitroCooldown = 0;

int roadOffset = 0;
bool isNight = false;

// ===== STRUCTS =====
struct Enemy { int lane, y; };
struct Police { int lane, y; } police;

vector<Enemy> enemies;

// ===== UTILS =====
void gotoxy(int x,int y){
    COORD c={(SHORT)x,(SHORT)y};
    SetConsoleCursorPosition(GetStdHandle(STD_OUTPUT_HANDLE),c);
}
void setColor(int c){
    SetConsoleTextAttribute(GetStdHandle(STD_OUTPUT_HANDLE),c);
}
void hideCursor(){
    CONSOLE_CURSOR_INFO i={1,FALSE};
    SetConsoleCursorInfo(GetStdHandle(STD_OUTPUT_HANDLE),&i);
}

// ===== FILE SYSTEM =====
void loadHighScore(){
    ifstream f("score.dat");
    if(f) f>>highScore;
}
void saveHighScore(){
    ofstream f("score.dat");
    f<<highScore;
}

// ===== SOUND =====
void engineSound(){ Beep(800,30); }
void crashSound(){ Beep(200,300); }

// ===== ROAD =====
void drawRoad(){
    int baseColor = isNight ? 1 : 8;

    for(int y=0;y<HEIGHT;y++){
        for(int x=10;x<=30;x++){
            gotoxy(x,y);

            if(x==10||x==30){
                setColor(baseColor);
                cout<<"|";
            }
            else if((y+roadOffset)%4==0 && (x==16||x==24)){
                setColor(7);
                cout<<"|";
            }
            else cout<<" ";
        }
    }
}

// ===== PLAYER =====
void drawPlayer(){
    setColor(nitro?14:10);
    gotoxy(LANES[playerLane],HEIGHT-2);
    cout<<"A";
}

// ===== ENEMIES =====
void spawnEnemy(){
    if(rand()%10<3){
        enemies.push_back({rand()%3,0});
    }
}
void moveEnemies(){
    for(auto &e:enemies) e.y++;
    enemies.erase(remove_if(enemies.begin(),enemies.end(),
        [](Enemy e){return e.y>HEIGHT;}),enemies.end());
}
void drawEnemies(){
    setColor(12);
    for(auto &e:enemies){
        gotoxy(LANES[e.lane],e.y);
        cout<<"V";
    }
}

// ===== POLICE AI =====
void initPolice(){
    police.lane=rand()%3;
    police.y=0;
}
void movePolice(){
    if(police.lane<playerLane) police.lane++;
    else if(police.lane>playerLane) police.lane--;

    police.y+= (score>200 ? 2 : 1);

    if(police.y>HEIGHT){
        police.y=0;
        police.lane=rand()%3;
    }
}
void drawPolice(){
    setColor(9);
    gotoxy(LANES[police.lane],police.y);
    cout<<"P";
}

// ===== INPUT =====
void input(){
    if(_kbhit()){
        char ch=_getch();

        if((ch=='a'||ch=='A')&&playerLane>0) playerLane--;
        if((ch=='d'||ch=='D')&&playerLane<2) playerLane++;

        if((ch=='w'||ch=='W') && nitroCooldown==0){
            nitro=true;
            nitroTimer=25;
            nitroCooldown=80;
        }
        if(ch=='q'||ch=='Q') gameOver=true;
    }
}

// ===== COLLISION =====
void explosion(){
    for(int i=0;i<5;i++){
        setColor(12);
        gotoxy(LANES[playerLane],HEIGHT-2);
        cout<<"X";
        Sleep(80);
        gotoxy(LANES[playerLane],HEIGHT-2);
        cout<<" ";
    }
    crashSound();
}
void checkCollision(){
    for(auto &e:enemies){
        if(e.y==HEIGHT-2 && e.lane==playerLane){
            explosion();
            gameOver=true;
        }
    }
    if(police.y==HEIGHT-2 && police.lane==playerLane){
        explosion();
        gameOver=true;
    }
}

// ===== UI =====
void drawUI(){
    setColor(7);
    gotoxy(35,2); cout<<"Score: "<<score;
    gotoxy(35,4); cout<<"High: "<<highScore;
    gotoxy(35,6); cout<<"Nitro: "<<(nitro?"ON ":"OFF");
}

// ===== MENU =====
void menu(){
    system("cls");
    setColor(11);
    cout<<"\n\n   🚗 ULTRA INSANE CAR GAME 🚗\n";
    cout<<"   Press any key to start...\n";
    _getch();
}

// ===== MAIN =====
int main(){
    srand(time(0));
    hideCursor();
    loadHighScore();
    menu();
    initPolice();

    while(!gameOver){

        drawRoad();
        input();

        spawnEnemy();
        moveEnemies();
        drawEnemies();

        movePolice();
        drawPolice();

        drawPlayer();

        checkCollision();
        drawUI();

        // DAY/NIGHT
        if(score%200==0) isNight=!isNight;

        // NITRO
        int speed = nitro ? 40 : 90;
        if(nitro){
            nitroTimer--;
            if(nitroTimer<=0) nitro=false;
        }
        if(nitroCooldown>0) nitroCooldown--;

        roadOffset++;
        score++;

        engineSound();
        Sleep(speed);
    }

    if(score>highScore){
        highScore=score;
        saveHighScore();
    }

    system("cls");
    setColor(12);
    cout<<"\n💥 GAME OVER\n";
    cout<<"Score: "<<score<<"\nHigh Score: "<<highScore<<"\n";

    cout<<"\nPress R to restart or Q to quit\n";
    char c=_getch();
    if(c=='r'||c=='R'){
        playerLane=1; score=0; gameOver=false;
        enemies.clear();
        main();
    }

    return 0;
}
