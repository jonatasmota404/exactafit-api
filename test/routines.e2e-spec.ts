import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe('Routines e2e', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let token: string;
    let exerciseId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports:[AppModule],
        }).compile()

        app = moduleFixture.createNestApplication();

        app.useGlobalPipes(
            new ValidationPipe({
                whitelist:true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );

        await app.init();
        prisma = app.get(PrismaService);
        
        const email = `test-${Date.now()}@example.com`;
            await request(app.getHttpServer())
            .post('/auth/register')
            .send({ name: 'Tester', email, password: 'password123' }).expect(201);

        

        const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'password123' }).expect(201);
        
        token = loginRes.body.accessToken;
        
        const exercise = await prisma.exercise.create({
        data: {
            name: 'Supino Reto',
            muscleGroup: 'chest',
            type: 'strength',
        },
        });
        exerciseId = exercise.id;

    });

    

    afterAll(async () => {
        await prisma.$disconnect();
        await app.close();
    });

    it('POST /routine -> deve criar uma ficha completa com exercicios planejados', async () => {
        const response = await request(app.getHttpServer())
        .post('/routine')
        .set('Authorization', `Bearer ${token}`)
        .send({
            name: 'Treino A - Peito e Tríceps',
        description: 'Foco em força',
        items: [
            {
                exerciseId,
                order: 1,
                targetSets: 4,
                targetReps: 10,
            },
        ],
        });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe('Treino A - Peito e Tríceps');
        expect(response.body.routineItems).toHaveLength(1);
    });

    it('deve retornar 401 se nenhum token for fornecido', async () => {
        const response = await request(app.getHttpServer())
            .post('/routine')
            .send({
            name: 'Treino Inválido',
            items: [],
            });

        expect(response.status).toBe(401);
    });

    it('deve retornar 400 se o campo name estiver ausente', async () => {
        const response = await request(app.getHttpServer())
            .post('/routine')
            .set('Authorization', `Bearer ${token}`)
            .send({
            // name omitido de propósito
            description: 'Sem nome',
            items: [],
            });

        expect(response.status).toBe(400);
    });
})