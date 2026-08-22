import pool from '../src/lib/db';

async function checkTriggers() {
    try {
        console.log("Checking triggers on table 'reservas'...");
        const [triggers]: any = await pool.query(`SHOW TRIGGERS WHERE \`Table\` = 'reservas'`);
        console.log("Triggers:", JSON.stringify(triggers, null, 2));

        for (const t of triggers) {
            console.log("\n--- TRIGGER:", t.Trigger, "---");
            console.log(t.Statement);
        }

        process.exit(0);
    } catch (err: any) {
        console.error("Error:", err);
        process.exit(1);
    }
}

checkTriggers();
