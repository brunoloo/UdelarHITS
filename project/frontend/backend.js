 const API = "http://localhost:5001/api";

      document.getElementById("pingBtn").addEventListener("click", async () => {
        try {
          const res = await fetch(API);
          const data = await res.json();
          alert(JSON.stringify(data.message)); 
        } catch (err) {
          console.error(err);
          alert("Error conectando al backend");
        }
      });