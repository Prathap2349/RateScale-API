from database import engine, Base
import models

def init_tables():
    print("[PostgreSQL] Connecting to PostgreSQL database...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ SUCCESS: All PostgreSQL tables ('simulations', 'simulation_results', 'recommendations') created successfully!")
    except Exception as e:
        print(f"❌ ERROR: Could not create tables in PostgreSQL: {e}")
        print("\nPlease check your password in ai_service/.env matches your pgAdmin PostgreSQL password.")

if __name__ == "__main__":
    init_tables()
