{
    page === "admin" && user.role === "admin" && (
        <>
            <div className="stats-grid">
                <Stat title="Total seats" value={overview?.overview?.total_seats ?? 0} icon={<Armchair />} />
                <Stat title="Active seats" value={overview?.overview?.active_seats ?? 0} icon={<CheckCircle2 />} />
                <Stat title="Today's reservations" value={overview?.today?.reservations ?? 0} icon={<CalendarDays />} />
                <Stat title="Checked in" value={overview?.today?.checked_in ?? 0} icon={<Users />} />
            </div>

            <section className="section-heading">
                <div>
                    <h3>Library management</h3>
                    <p>Create and organize study spaces.</p>
                </div>
            </section>

            <div className="zone-grid">
                <form className="zone-card" onSubmit={createZone}>
                    <div className="zone-icon"><Plus /></div>
                    <h3>Create library zone</h3>

                    <label>
                        Zone name
                        <input required maxLength="80"
                            value={zoneForm.name}
                            onChange={e => setZoneForm({ ...zoneForm, name: e.target.value })} />
                    </label>

                    <label>
                        Floor
                        <input required maxLength="40"
                            value={zoneForm.floor}
                            onChange={e => setZoneForm({ ...zoneForm, floor: e.target.value })} />
                    </label>

                    <label>
                        Description
                        <input maxLength="300"
                            value={zoneForm.description}
                            onChange={e => setZoneForm({ ...zoneForm, description: e.target.value })} />
                    </label>

                    <button className="primary-btn">Create zone</button>
                </form>

                <form className="zone-card" onSubmit={createSeat}>
                    <div className="zone-icon"><Armchair /></div>
                    <h3>Add library seat</h3>

                    <label>
                        Select zone
                        <select required value={seatForm.zoneId}
                            onChange={e => setSeatForm({ ...seatForm, zoneId: e.target.value })}>
                            <option value="">Choose zone</option>
                            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                        </select>
                    </label>

                    <label>
                        Seat number
                        <input required maxLength="20"
                            value={seatForm.seatNumber}
                            onChange={e => setSeatForm({ ...seatForm, seatNumber: e.target.value })} />
                    </label>

                    <label>
                        Seat type
                        <select value={seatForm.seatType}
                            onChange={e => setSeatForm({ ...seatForm, seatType: e.target.value })}>
                            <option value="standard">Standard</option>
                            <option value="computer">Computer</option>
                            <option value="accessible">Accessible</option>
                        </select>
                    </label>

                    <button className="primary-btn">Add seat</button>
                </form>
            </div>
        </>
    )
}