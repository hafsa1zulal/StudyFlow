from flask import Flask, render_template, request, jsonify
import sqlite3
import os

app = Flask(__name__)

def get_db():
    conn = sqlite3.connect("database.db")
    conn.row_factory = sqlite3.Row
    return conn

# tablo yoksa otomatik oluştur
def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            done INTEGER DEFAULT 0
        )
    ''')
    conn.commit()
    conn.close()

init_db()

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/tasks", methods=["GET"])
def get_tasks():
    conn = get_db()
    tasks = conn.execute("SELECT * FROM tasks").fetchall()
    conn.close()

    return jsonify([
        {"id": t["id"], "title": t["title"], "done": t["done"]}
        for t in tasks
    ])

@app.route("/tasks", methods=["POST"])
def add_task():
    data = request.get_json()
    
    # boş veri kontrolü
    if not data or not data.get("title") or str(data["title"]).strip() == "":
        return jsonify({"error": "Görev başlığı boş olamaz"}), 400

    conn = get_db()
    conn.execute("INSERT INTO tasks (title) VALUES (?)", (data["title"].strip(),))
    conn.commit()
    conn.close()

    return jsonify({"status": "ok"})

@app.route("/tasks/<int:id>", methods=["DELETE"])
def delete_task(id):
    conn = get_db()
    conn.execute("DELETE FROM tasks WHERE id=?", (id,))
    conn.commit()
    conn.close()

    return jsonify({"status": "deleted"})

@app.route("/tasks/<int:id>/toggle", methods=["PUT"])
def toggle_task(id):
    conn = get_db()
    task = conn.execute("SELECT done FROM tasks WHERE id=?", (id,)).fetchone()

    # ID veritabanında yoksa hatayı engelle
    if task is None:
        conn.close()
        return jsonify({"error": "Görev bulunamadı"}), 404

    new_value = 0 if task["done"] == 1 else 1
    conn.execute("UPDATE tasks SET done=? WHERE id=?", (new_value, id))
    conn.commit()
    conn.close()

    return jsonify({"status": "updated"})

if __name__ == "__main__":
    app.run(debug=True)